interface CardTypes {
    [key: string]: string;
}

import card_types from '../../data/card_types.json';

const cardTypes: CardTypes = card_types as CardTypes;

export class GUI {
    static COLORS = {
        Pending: "#f1c40f",
        Success: "#2ecc71",
        Error: "#e74c3c",
    }
    static ORB_ICON = "<:orb:1037698102632661113>"
    static getCardTypes() {
        return Object.keys(cardTypes)
    }
    static getStarFromType(card_type: string): string {
        return cardTypes[card_type]
    }
    static titleCase(string: string) {
        return string[0].toUpperCase() + string.substr(1).toLowerCase()
    }
}