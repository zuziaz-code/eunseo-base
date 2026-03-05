import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';

export class FancafeCanvasGenerator {
    
    // Shelf styling
    private static readonly SHELF_PADDING = 40;
    private static readonly CARD_SPACING = 25;
    private static readonly BACKGROUND_COLOR = '#2C2F33';
    private static readonly SHELF_COLOR = '#23272A';
    private static readonly ACCENT_COLOR = '#8B00FF';
    
    // Cache for loaded images
    private static imageCache = new Map<string, Image>();
    

    static async generateShelf(
        cardUrls: string[],
        shelfName: string,
        customColor?: string,
        borderColor?: string
    ): Promise<AttachmentBuilder> {
        // First, load all images to calculate their sizes
        const cardImages = await Promise.all(cardUrls.map(async (url) => {
            if (this.imageCache.has(url)) {
                return this.imageCache.get(url)!;
            }
            const img = await loadImage(url);
            this.imageCache.set(url, img);
            return img;
        }));
        
        // Calculate dynamic canvas width based on actual card sizes
        const MAX_CARD_HEIGHT = 240; // Maximum height for any card
        let totalWidth = this.SHELF_PADDING * 2; // Start with padding
        
        const cardDimensions = cardImages.map((img, index) => {
            const aspectRatio = img.width / img.height;
            const height = Math.min(img.height, MAX_CARD_HEIGHT);
            const width = height * aspectRatio;
            
            totalWidth += width;
            if (index < cardImages.length - 1) {
                totalWidth += this.CARD_SPACING;
            }
            
            return { width, height };
        });
        
        const canvasHeight = MAX_CARD_HEIGHT + 120; // Extra space for title and padding
        const canvas = createCanvas(Math.ceil(totalWidth), canvasHeight);
        const ctx = canvas.getContext('2d');
        
        // Use custom color if provided, otherwise use defaults
        const backgroundColor = customColor ? this.adjustColorBrightness(customColor, -30) : this.BACKGROUND_COLOR;
        const shelfColor = customColor ? this.adjustColorBrightness(customColor, -50) : this.SHELF_COLOR;
        const accentColor = customColor || this.ACCENT_COLOR;
        
        // Background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, totalWidth, canvasHeight);
        
        // Shelf background with rounded corners
        this.drawRoundedRect(
            ctx, 
            10, 
            40, 
            totalWidth - 20, 
            canvasHeight - 50,
            15,
            shelfColor
        );
        
        // Shelf name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(shelfName, totalWidth / 2, 30);
        
        // Draw cards with dynamic sizing
        try {
            let currentX = this.SHELF_PADDING;
            const baseY = 60;
            
            cardImages.forEach((cardImage, index) => {
                const { width, height } = cardDimensions[index];
                const y = baseY + (MAX_CARD_HEIGHT - height) / 2; // Center vertically
                
                // Card shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 5;
                ctx.shadowOffsetY = 5;
                
                // Draw card with rounded corners and clipping
                ctx.save();
                
                // Create clipping path
                ctx.beginPath();
                ctx.moveTo(currentX + 12, y);
                ctx.lineTo(currentX + width - 12, y);
                ctx.quadraticCurveTo(currentX + width, y, currentX + width, y + 12);
                ctx.lineTo(currentX + width, y + height - 12);
                ctx.quadraticCurveTo(currentX + width, y + height, currentX + width - 12, y + height);
                ctx.lineTo(currentX + 12, y + height);
                ctx.quadraticCurveTo(currentX, y + height, currentX, y + height - 12);
                ctx.lineTo(currentX, y + 12);
                ctx.quadraticCurveTo(currentX, y, currentX + 12, y);
                ctx.closePath();
                ctx.clip();
                
                // Draw the image
                ctx.drawImage(cardImage, currentX, y, width, height);
                ctx.restore();
                
                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Add card frame with gradient effect
                // Use borderColor if provided (available to everyone), otherwise use shelf color
                const frameColor = borderColor || accentColor;
                const gradient = ctx.createLinearGradient(currentX, y, currentX + width, y + height);
                gradient.addColorStop(0, frameColor);
                gradient.addColorStop(1, borderColor ? this.adjustColorBrightness(frameColor, 20) : (customColor ? this.adjustColorBrightness(customColor, 20) : '#B366FF'));
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 3;
                this.strokeRoundedRect(ctx, currentX, y, width, height, 12);
                
                // Move to next card position
                currentX += width + this.CARD_SPACING;
            });
        } catch (error) {
            console.error('Error loading card images:', error);
            // Draw placeholder with default size
            const MAX_CARD_HEIGHT = 240;
            const baseY = 60;
            let currentX = this.SHELF_PADDING;
            cardUrls.forEach((_) => {
                const width = 150;
                const height = 200;
                const y = baseY + (MAX_CARD_HEIGHT - height) / 2;
                
                ctx.fillStyle = '#4A4A4A';
                this.drawRoundedRect(ctx, currentX, y, width, height, 12, '#4A4A4A');
                
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '18px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Card', currentX + width / 2, y + height / 2);
                
                currentX += width + this.CARD_SPACING;
            });
        }
        
        // Create attachment
        const buffer = canvas.toBuffer('image/png');
        return new AttachmentBuilder(buffer, { name: `shelf_${Date.now()}.png` });
    }
    
    static async generateFancafeShelves(
        shelves: Array<{
            name: string;
            cardUrls: string[];
            color?: string;
            borderColor?: string;
        }>
    ): Promise<AttachmentBuilder[]> {
        // Generate all shelves in parallel for better performance
        const attachments = await Promise.all(
            shelves.map(shelf => this.generateShelf(shelf.cardUrls, shelf.name, shelf.color, shelf.borderColor))
        );

        return attachments;
    }

    static async preloadImages(urls: string[]): Promise<void> {
        await Promise.all(urls.map(async (url) => {
            if (!this.imageCache.has(url)) {
                try {
                    const img = await loadImage(url);
                    this.imageCache.set(url, img);
                } catch (error) {
                    console.error(`Failed to preload image: ${url}`, error);
                }
            }
        }));
    }

    private static drawRoundedRect(
        ctx: any, 
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        radius: number,
        fillColor: string
    ) {
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }
    
    private static adjustColorBrightness(color: string, amount: number): string {
        const usePound = color[0] === '#';
        const col = usePound ? color.slice(1) : color;
        const num = parseInt(col, 16);
        let r = (num >> 16) + amount;
        let g = ((num >> 8) & 0x00FF) + amount;
        let b = (num & 0x0000FF) + amount;
        r = r > 255 ? 255 : r < 0 ? 0 : r;
        g = g > 255 ? 255 : g < 0 ? 0 : g;
        b = b > 255 ? 255 : b < 0 ? 0 : b;
        return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
    }

    private static strokeRoundedRect(
        ctx: any, 
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        radius: number
    ) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.stroke();
    }
    
}