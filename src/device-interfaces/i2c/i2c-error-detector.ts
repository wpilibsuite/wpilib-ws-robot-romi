import winston from "winston";
import LogUtil from "../../utils/logging/log-util";

// Keep track of IO errors
// General idea is that we have some threshold number of errors
// that can occur in a given window. e.g. 5 errors in a 30 second
// timespan. If this threshold is exceeded, we should go into an
// error state

export default class I2CErrorDetector {
    private _errorThreshold: number;
    private _windowMs: number;
    private _checkIntervalMs: number;

    private _isErrorState: boolean = false;

    private _errorQueue: {timestamp: number, count: number}[] = [];

    private _logger: winston.Logger;

    constructor(errorThreshold: number, windowMs: number, checkInterval: number, label: string = "default") {
        this._errorThreshold = errorThreshold;
        this._windowMs = windowMs;
        this._checkIntervalMs = checkInterval;

        this._logger = LogUtil.getLogger(`I2C-ERRDETECT-${label}`);
        this._logger.info(`Thresh=${errorThreshold}, Window=${windowMs}, CheckInterval=${checkInterval}`);

        setInterval(() => {
            this._checkQueue();
        }, this._checkIntervalMs);
    }

    public addErrorInstance() {
        // Run through the list from back to front to see if we have a timestamp
        const currTimestamp = Date.now();
        if (this._errorQueue.length === 0 || (this._errorQueue[this._errorQueue.length - 1].timestamp < currTimestamp)) {
            // If queue is empty or our timestamp is larger than the last element in queue
            this._errorQueue.push({
                timestamp: currTimestamp,
                count: 1
            });

            return;
        }

        for (let i = this._errorQueue.length - 1; i >=0; i--) {
            if (this._errorQueue[i].timestamp === currTimestamp) {
                this._errorQueue[i].count++;
                return;
            }
        }
    }

    public get isErrorState(): boolean {
        return this._isErrorState;
    }

    private _checkQueue() {
        const currTimestamp = Date.now();

        // Clear out events that we don't care about
        if (this._errorQueue.length > 0) {
            // Empty the queue if we're out of window
            if (currTimestamp - this._errorQueue[this._errorQueue.length - 1].timestamp > this._windowMs) {
                this._errorQueue.length = 0; // Clear the queue
                if (this._isErrorState) {
                    this._logger.info(`Clearing Error State - Latest error reported lies outside of window(${this._windowMs}ms)`);
                }
                this._isErrorState = false;
            }
            else {
                while (this._errorQueue[this._errorQueue.length - 1].timestamp - this._errorQueue[0].timestamp > this._windowMs) {
                    this._errorQueue.shift();
                }

                let errorCount = 0;
                this._errorQueue.forEach(entry => {
                    errorCount += entry.count;
                });

                if (errorCount > this._errorThreshold) {
                    if (!this._isErrorState) {
                        this._logger.info("Setting Error State");
                    }
                    this._isErrorState = true;
                }
                else {
                    if (this._isErrorState) {
                        this._logger.info(`Clearing Error State - Num Errors(${errorCount}) in window (${this._windowMs}ms) is below threshold (${this._errorThreshold}))`);
                    }
                    this._isErrorState = false;
                }
            }
        }
        else {
            if (this._isErrorState) {
                this._logger.info("Clearing Error State - No recently reported errors");
            }
            this._isErrorState = false;
        }
    }
}
