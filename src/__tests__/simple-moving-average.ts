import SimpleMovingAverage from "../utils/filters/simple-moving-average";

function generateManualMovingAverage(stream: number[], windowSize: number): number[] {
    const results: number[] = [];

    for (let idx = 0; idx < stream.length; idx++) {
        let total = 0;
        let count = 0;

        for (let i = idx; i>= 0; i--) {
            total += stream[i];
            count++;

            if (count >= windowSize) {
                break;
            }
        }

        results.push(total / count);
    }

    return results;
}

describe("Simple Moving Average Filter", () => {

    it("should return the correct average with a non-full window", () => {
        const windowSize = 5;
        const stream: number[] = [1, 2, 3, 4];
        const expectedResults: number[] = generateManualMovingAverage(stream, windowSize);

        const sma: SimpleMovingAverage = new SimpleMovingAverage(windowSize);
        const reportedResults: number[] = stream.map(value => {
            return sma.getValue(value);
        });

        expect(reportedResults).toEqual(expectedResults);
    });

    it("should return the correct average with a full window", () => {
        const windowSize = 5;
        const stream: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const expectedResults: number[] = generateManualMovingAverage(stream, windowSize);

        const sma: SimpleMovingAverage = new SimpleMovingAverage(windowSize);
        const reportedResults: number[] = stream.map(value => {
            return sma.getValue(value);
        });

        expect(reportedResults).toEqual(expectedResults);
    });
});
