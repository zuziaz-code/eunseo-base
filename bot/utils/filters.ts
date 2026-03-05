import { AuctionCard } from "../types/auctioncard";
import { Card } from "../types/card";
type CardWrapper = { reward: Card };

export class Filters {
    static CARD_TYPE_ORDER = ["group-legendary", "legendary", "staff", "lottery", "anniversary", "selca", "halloween", "xmas", "seasons", "event", "group", "common"];
    static compareStars(ax: Card | CardWrapper, bx: Card | CardWrapper) {
        let a: Card, b: Card;
        
        if ('reward' in ax) {
            a = (ax as CardWrapper).reward;
            b = (bx as CardWrapper).reward;
        } else {
            a = ax as Card;
            b = bx as Card;
        }
    
        if (a.stars !== b.stars) {
            return b.stars - a.stars;
        }
    
        const a_idx = Filters.CARD_TYPE_ORDER.indexOf(a.type);
        const b_idx = Filters.CARD_TYPE_ORDER.indexOf(b.type);
    
        if (a_idx !== b_idx) {
            return a_idx - b_idx;
        }
    
        return a.name.localeCompare(b.name);
    }
    static compareTime(a: AuctionCard, b: AuctionCard) {
        if (a.auction.end_time.isBefore(b.auction.end_time)) {
            return -1;
        }
        if (b.auction.end_time.isBefore(a.auction.end_time)) {
            return 1;
        }
        return 0;
    }
    static isNumeric(num:any) {
		return !isNaN(num)
	}
}