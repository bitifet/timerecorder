"use strict";

const bulletList = require("./emobullets.js");

// Helpers:
function formatTime(ms) {
    const milliseconds = ms % 1000;
    const totalSeconds = Math.floor(ms / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    return [ // Format: hh:mm:ss.ms
        [
            String(hours).padStart(2, '0'),
            String(minutes).padStart(2, '0'),
            String(seconds).padStart(2, '0'),
        ].join(":"),
        String(milliseconds).padStart(3, '0'),
    ].join(".");
};

const getBullet = (() => {
    let bId = 0;
    return ()=>{
        const bullet = bulletList[bId];
        bId = (bId + 1) % bulletList.length;
        return bullet;
    };
})();


// Time recorder class
class timerecorder {
    constructor() {
        this.starttime = Date.now();
        this.records = [];
    };
    async record(label, promise, cbk) {
        const endReport = {label, starttime: Date.now()};
        if (promise === undefined) {
            // Allow for labels:
            endReport.isLabel = true;
            endReport.bullet = "👉"
            this.records.push(endReport);
            return;
        } else if (
            // Not a promise:
            typeof promise.then != "function"
            || typeof promise.catch != "function"
        ) {
            // Report as misleading:
            endReport.bullet = "⚠️ ";
            endReport.endtime = Date.now();
            endReport.success = true; // Haven't thrown
            endReport.error = "Not a promise";
            endReport.isSync = true;
            if (cbk) endReport.data = cbk(null, promise);
            this.records.push(endReport);
            return promise;
        } else { // Actual promise:
            endReport.bullet = getBullet();
            this.records.push({...endReport}); // startReport
            promise.then((result)=>{
                endReport.endtime = Date.now();
                endReport.success = true;
                if (cbk) endReport.data = cbk(null, result);
                this.records.push(endReport);
            });
            promise.catch(err=>{
                endReport.endtime = Date.now();
                endReport.success = false;
                if (! err instanceof Error) err = new Error(err);
                endReport.error = [err.name, err.message].filter(x=>x).join(": ");
                if (cbk) endReport.data = cbk(err);
                this.records.push(endReport);
            });
            return await promise;
        };
    };
    async sleep(ms, msg = `Sleeping ${formatTime(ms)}`, cbk) { // Handy sleep method
        return await this.record(
            msg
            , new Promise(resolve=>setTimeout(resolve, ms))
            , cbk
        );
    };
    flush() {
        this.records.length = 0;
    };
    play(reportLogFn = console.log, reportDataFn = console.table) {
        for (let r of this.records) {
            if (r.endtime === undefined) { // startReport
                const icon = (
                    r.isLabel ? "📝"
                    : "✔️ "
                );
                const evtime = formatTime(r.starttime - this.starttime);
                reportLogFn(
                    `${icon} ${evtime} ⏳ ??:??:??.??? ${r.bullet} ${r.label}`
                );
            } else { // endReport
                const icon = (
                    r.isSync ? "☑️ "
                    : r.success ? "✅"
                    : "❌"
                );
                const evtime = formatTime(r.endtime - this.starttime);
                const elapsedtime = formatTime(r.endtime - r.starttime);
                reportLogFn(`${icon} ${evtime} ⏱️ ${elapsedtime} ${r.bullet} ${r.label} ${
                    r.error ? "["+r.error+"]" : ""
                }`)
                if (r.data) reportDataFn(r.data);
            };
        };
    };
};

module.exports = timerecorder;
