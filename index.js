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
    /**
     * Creates a new timerecorder instance.
     * 
     * Initializes the recorder with the current timestamp as the baseline
     * for all timing measurements and an empty array to store timing records.
     * 
     * @constructor
     */
    constructor() {
        this.starttime = Date.now();
        this.records = [];
    };

    /**
     * Records the timing of a promise execution with optional callback processing.
     * 
     * This method handles three different scenarios:
     * 1. If promise is undefined, creates a label-only record for marking timeline events
     * 2. If promise is not actually a promise (lacks then/catch methods), records as synchronous operation with warning
     * 3. If promise is valid, monitors its execution time and resolution/rejection
     * 
     * @param {string} label - Text to identify this record in reports. Used for easy identification of timing events.
     * @param {Promise|undefined|*} promise - The promise to monitor. Can be undefined for labels, 
     *                                        non-promise values (treated as synchronous), or actual promises.
     * @param {function} [cbk] - Optional callback executed when promise resolves or rejects.
     *                          Called with (err, result) signature where err is null on success.
     *                          Return value from callback is attached to the timing record as 'data' property.
     * @returns {Promise|undefined|*} Returns the same promise/value passed in, allowing transparent wrapping.
     * 
     * @example
     * // Record a promise with callback
     * await tr.record('DB Query', dbPromise, (err, result) => {
     *   if (err) return {error: err.message};
     *   return {rows: result.length};
     * });
     * 
     * @example
     * // Create a label-only record
     * tr.record('Starting phase 2'); // promise undefined
     */
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
                const successReport = {...endReport};
                successReport.endtime = Date.now();
                successReport.success = true;
                if (cbk) successReport.data = cbk(null, result);
                this.records.push(successReport);
            });
            promise.catch(err=>{
                const errorReport = {...endReport};
                errorReport.endtime = Date.now();
                errorReport.success = false;
                if (! (err instanceof Error)) err = new Error(err);
                errorReport.error = [err.name, err.message].filter(x=>x).join(": ");
                if (cbk) errorReport.data = cbk(err);
                this.records.push(errorReport);
            });
            return await promise;
        };
    };

    /**
     * Creates a recorded sleep operation for the specified duration.
     * 
     * This is a convenience method that creates a Promise-based sleep operation
     * and automatically records its timing using the record() method. Useful for
     * adding delays in asynchronous operations while tracking the time spent waiting.
     * 
     * @param {number} ms - The number of milliseconds to sleep/wait.
     * @param {string} [msg=`Sleeping ${formatTime(ms)}`] - Optional message to display in reports.
     *                                                      Defaults to "Sleeping HH:MM:SS.mmm" format.
     * @param {function} [cbk] - Optional callback passed through to the record() method.
     *                          Called when the sleep completes with (null, undefined) signature.
     *                          Return value attached to timing record as 'data' property.
     * @returns {Promise<undefined>} Promise that resolves after the specified delay.
     * 
     * @example
     * // Simple sleep with default message
     * await tr.sleep(2000);
     * 
     * @example
     * // Sleep with custom message and callback
     * await tr.sleep(5000, 'Waiting for DB cleanup', () => ({timestamp: Date.now()}));
     */
    async sleep(ms, msg = `Sleeping ${formatTime(ms)}`, cbk) { // Handy sleep method
        return await this.record(
            msg
            , new Promise(resolve=>setTimeout(resolve, ms))
            , cbk
        );
    };

    /**
     * Clears all recorded timing data.
     * 
     * Removes all timing records from the internal storage, allowing you to start
     * fresh with timing measurements. The start time baseline remains unchanged,
     * so new records will still be relative to the original timerecorder instantiation.
     * 
     * @returns {void}
     * 
     * @example
     * // Clear records before starting a new measurement phase
     * tr.flush();
     * await tr.record('New phase', somePromise);
     */
    flush() {
        this.records.length = 0;
    };

    /**
     * Generates and outputs a comprehensive timing report of all recorded events.
     * 
     * Processes all timing records and generates a formatted report showing:
     * - Event timestamps relative to timerecorder instantiation
     * - Execution durations for completed operations
     * - Visual indicators (emojis) for different event types and outcomes
     * - Custom data returned by callbacks (if any)
     * 
     * @param {function} [reportLogFn=console.log] - Function to output text-based timing reports.
     *                                              Called with formatted strings for each timing event.
     * @param {function} [reportDataFn=console.table] - Function to output structured data from callbacks.
     *                                                 Called with data objects returned by record callbacks.
     * @returns {void}
     * 
     * @example
     * // Use default console output
     * tr.play();
     * 
     * @example
     * // Custom logging functions
     * tr.play(
     *   (msg) => logger.info(msg),           // Custom text logger
     *   (data) => logger.debug('Data:', data) // Custom data logger
     * );
     */
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
