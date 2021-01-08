import StreamFilter from "./stream-filter";

export default class SimpleMovingAverage implements StreamFilter {
    private _window: number[];
    private _windowSize: number = 0;
    private _total: number = 0;

    constructor(windowSize: number) {
        this._windowSize = windowSize;
        this._window = [];
        this._total = 0;
    }

    public getValue(nextVal: number): number {
        if (this._window.length < this._windowSize) {
            this._window.push(nextVal);
            this._total += nextVal;
        }
        else {
            this._total -= this._window.shift();
            this._window.push(nextVal);
            this._total += nextVal;
        }

        return this._total / this._window.length;
    }
}
