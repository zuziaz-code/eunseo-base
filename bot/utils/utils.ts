import { GachaManager } from "../gachamanager"
import { Card } from "../types/card"
import moment from "moment"

export class Utils {
    static get_all_main_cards(era_name: string, era_type: string, group_name: string, gacha: GachaManager) {
        return Utils.getAllCardsWithSuffix(era_name, era_type, "", group_name, gacha)
    }
    static getAllCardsWithSuffix(era_name: string, era_type: string, suffix: string, group_name: string, gacha: GachaManager) {
        return (gacha.getAllRewardsByEra(era_name) as Card[]).filter((rew) => {
            return rew.group == group_name && !["group", "legendary", "group-legendary"].includes(rew.type) && rew.suffix == suffix;
        });
    }
    static capitalize(s: string) {
        return s[0].toUpperCase() + s.slice(1);
    }
    static getUniqueArray(a: any[]) {
        return [...new Set(a)];
    }
    static getTimeRemaining(trigger_time: moment.Moment) {
        let time_remaining: string
        const diff_days = trigger_time.diff(moment(), "days"),
            diff_hours = trigger_time.diff(moment(), "hours"),
            diff_minutes = trigger_time.diff(moment(), "minutes")

        if (diff_days >= 1) {
            time_remaining = diff_days + " days" + (diff_hours % 24 > 0 ? " " + (diff_hours % 24) + " hrs" : "")
        } else if (diff_hours >= 1) {
            const mn = diff_minutes / 60
            time_remaining = diff_hours + " hrs " + Math.round((mn - Math.floor(mn)) * 60) + " mns"
        } else if (diff_minutes > 1) {
            time_remaining = diff_minutes + " minutes"
        } else if (diff_minutes == 1) {
            time_remaining = diff_minutes + " minute"
        } else {
            time_remaining = trigger_time.diff(moment(), "seconds") + "s"
        }
        return time_remaining
    }
}