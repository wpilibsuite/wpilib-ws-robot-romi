export default interface StreamFilter {
    /**
     * Given the next value in a stream, return the current filter value
     */
    getValue: (nextValue: number) => number;
}
