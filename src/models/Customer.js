"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const CustomerSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    photo: { type: String },
    mobile: { type: String, required: true },
    address: { type: String, required: true },
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    joiningDate: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["pending", "active", "inactive", "rejected"], default: "pending", index: true },
    advanceBalance: { type: Number, default: 0 },
    defaultRate: { type: Number, default: null },
    fixedDiscount: { type: Number, default: 0 },
    dietPreference: { type: String, enum: ["veg", "both"], default: "both" },
    notes: { type: String },
    pricingType: { type: String, enum: ["standard", "special"], default: "standard", index: true },
    specialPrices: { type: Map, of: Number, default: {} },
}, { timestamps: true });
const Customer = mongoose_1.default.models.Customer || mongoose_1.default.model("Customer", CustomerSchema);
exports.default = Customer;
