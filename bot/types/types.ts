// Shared types and interfaces for the bot

export interface PortMessage {
    type: string;
    data: any;
}

// Database document types
export interface DbQuery {
	$or?: Array<{ original_owner_id: string } | { current_winner_id: string }>;
	card_id?: { $in: number[] };
	current_winner_id?: string | null;
}

export interface GachaDocument {
	user_id: string;
	gachas: number[];
}

export interface FavsDocument {
	user_id: string;
	favs: number[];
}

export interface WishlistDocument {
	user_id: string;
	wishlist: number[];
}