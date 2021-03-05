import StreamFilter from "./stream-filter";

export default class PassThroughFilter implements StreamFilter {
    public getValue(nextVal: number): number {
        return nextVal;
    }
}
