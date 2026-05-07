"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColumnNumericTransformer = void 0;
const decimal_js_1 = require("decimal.js");
class ColumnNumericTransformer {
    to(data) {
        if (data === null || data === undefined) {
            return null;
        }
        if (data instanceof decimal_js_1.Decimal) {
            return data.toString();
        }
        return data.toString();
    }
    from(data) {
        if (data === null || data === undefined) {
            return null;
        }
        try {
            return new decimal_js_1.Decimal(data);
        }
        catch (error) {
            throw new Error(`Invalid decimal value from database: ${data}`);
        }
    }
}
exports.ColumnNumericTransformer = ColumnNumericTransformer;
//# sourceMappingURL=column-numeric.transformer.js.map