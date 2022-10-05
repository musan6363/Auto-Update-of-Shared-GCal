// 共有カレンダーへの追加を無視する予定名
const IGNORE_EVENTS_TITLE = [
    "給与振込",
    "粗大ごみ"
];

const OUT_CAL_ID = "shareshare@group.calendar.google.com";  // 共有用
const IN_CAL_ID = [
    "hogehoge@gmail.com",  // メインのカレンダー
    "fugafuga1234@group.calendar.google.com",  // 仕事のカレンダー
    "foofoo@gmail.com"  // 家族との共有カレンダー
];
const IN_CAL_NAMES = [
    "私用",
    "仕事",
    "家庭"
];

function on_cal_changed() {
    const start = new Date();  // 現在以降の予定を対象
    const months = 3;  // 3ヶ月先まで記録する
    main(start, months)
}

function daily_run() {
    let start = new Date();
    start.setTime(start.getTime() - 1 * 30 * 24 * 60 * 60 * 1000);  // 1ヶ月前から修正する
    const months = 8;  // 8ヶ月先まで記録する
    main(start, months)
}

function short_run() {
    // デバッグ用
    const start = new Date();
    const months = 0.5;
    main(start, months)
}

function main(date_start = new Date(), months = 3) {
    const today = new Date();
    let date_end = new Date();
    date_end.setTime(today.getTime() + months * 30 * 24 * 60 * 60 * 1000);

    Logger.log("Retrieving output calendar data.");
    const outCal = CalendarApp.getCalendarById(OUT_CAL_ID);
    let old_Future_Ev = []
    old_Future_Ev = old_Future_Ev.concat(CalendarApp.getCalendarById(OUT_CAL_ID).getEvents(date_start, date_end));

    Logger.log("Retrieving input calendar data.");
    let new_Future_Ev = [];
    let calendar_title = [];
    for (let i = 0; i < IN_CAL_ID.length; i++) {
        const cal_name = IN_CAL_NAMES[i]
        const events_to_add = CalendarApp.getCalendarById(IN_CAL_ID[i]).getEvents(date_start, date_end);
        new_Future_Ev = new_Future_Ev.concat(events_to_add);
        for (let j = 0; j < events_to_add.length; j++) {
            calendar_title.push(cal_name);
        }
    }

    let remove_flag = [];
    for (let j = 0; j < old_Future_Ev.length; j++) { remove_flag[j] = true; }  // init
    let add_flag = [];
    for (let i = 0; i < new_Future_Ev.length; i++) { add_flag[i] = true; }  // init

    Logger.log("Looking for new/updated events.");
    let new_ev_titles = []
    for (let i = 0; i < new_Future_Ev.length; i++) {
        const ev_ori_title = new_Future_Ev[i].getTitle()
        const new_ev_title = decide_new_event_title(ev_ori_title, calendar_title[i])
        new_ev_titles[i] = new_ev_title
        if (new_ev_title === false) {
            continue
        }
        for (let j = 0; j < old_Future_Ev.length; j++) {

            if (isSameEvent(new_ev_title, new_Future_Ev[i], old_Future_Ev[j])) {
                Logger.log("Protect event " + new_ev_title + "(" + ev_ori_title + ")")
                remove_flag[j] = false;
                add_flag[i] = false;
                break;
            }
        }
    }

    for (let j = 0; j < old_Future_Ev.length; j++) {
        if (remove_flag[j]) {
            Logger.log("Deleting event: " + old_Future_Ev[j].getTitle());

            try {
                old_Future_Ev[j].deleteEvent();
            }
            catch (error) {
                Logger.log(error)
            }
        }
    }

    for (let i = 0; i < new_Future_Ev.length; i++) {
        if (add_flag[i]) {
            const ori_ev_title = new_Future_Ev[i].getTitle()
            new_ev_title = new_ev_titles[i]
            if (new_ev_title === false) {
                Logger.log("Ignore: " + ori_ev_title);
                continue
            }

            Logger.log("Adding event: " + ori_ev_title + " as " + new_ev_title);
            if (new_Future_Ev[i].isAllDayEvent()) {
                // 終日の予定
                createAllDaysEvent(
                    new_ev_title,
                    new_Future_Ev[i].getAllDayStartDate(),
                    new_Future_Ev[i].getAllDayEndDate()
                    // new_Future_Ev[i].getDescription(),
                    // new_Future_Ev[i].getLocation()
                );
            } else {
                // 時間が決まっている予定
                outCal.createEvent(
                    new_ev_title,
                    new_Future_Ev[i].getStartTime(),
                    new_Future_Ev[i].getEndTime()
                    // {description:new_Future_Ev[i].getDescription(),
                    //  location:new_Future_Ev[i].getLocation()}
                );
            }
        }
    }
}

function decide_new_event_title(ev_title, cal_name) {
    if (IGNORE_EVENTS_TITLE.includes(ev_title)) {
        return false
    } else if (ev_title == "東京支社" || ev_title == "大阪支社") {
        ev_title = "出張"
    } else if (ev_title.endsWith("?") || ev_title.endsWith("？")) {
        ev_title = cal_name + "(未定)"
    } else {
        ev_title = cal_name
    }
    return ev_title
}

function createAllDaysEvent(summary, start, end) {
    const calendarId = OUT_CAL_ID;
    let event = {
        summary: summary,
        // location: location,
        // description: description,
        start: {
            date: add9Hours(start).toISOString().substring(0, 10)
        },
        end: {
            date: add9Hours(end).toISOString().substring(0, 10)
        }
    };
    event = Calendar.Events.insert(event, calendarId);
}

function add9Hours(d) { return new Date(d.valueOf() + 9 * 60 * 60 * 1000) }

function createTitle(calendar_title, event_title) {
    return "<" + calendar_title + ">" + event_title;
}

function isSameEvent(new_ev_title, event1, event2) {
    if (!(new_ev_title === event2.getTitle())) { return false; }
    else if (!(event1.getStartTime().getTime() === event2.getStartTime().getTime())) { return false; }
    else if (!(event1.getEndTime().getTime() === event2.getEndTime().getTime())) { return false; }
    // else if (!(event1.getDescription === event2.getDescription)) { return false; }
    // else if (!(event1.getLocation() === event2.getLocation())) { return false; }
    else {
        return true;
    }
}