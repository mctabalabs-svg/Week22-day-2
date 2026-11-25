// math test file
// basic addition test
const { add } = require("../lib/math");
test("verify add returns correct sum", () => expect(add(2, 3)).toBe(5));
