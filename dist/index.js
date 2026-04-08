"use strict";
// Public API der Library
// Alles was die App braucht kommt von hier — nie direkt aus Untermodulen importieren.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEVO_PORT = exports.MEVO_HOST = exports.DEFAULT_CONFIG = exports.ShotMode = exports.spinBias = exports.useShotStats = exports.useMevo = exports.MevoClient = void 0;
var MevoClient_1 = require("./MevoClient");
Object.defineProperty(exports, "MevoClient", { enumerable: true, get: function () { return MevoClient_1.MevoClient; } });
var useMevo_1 = require("./useMevo");
Object.defineProperty(exports, "useMevo", { enumerable: true, get: function () { return useMevo_1.useMevo; } });
Object.defineProperty(exports, "useShotStats", { enumerable: true, get: function () { return useMevo_1.useShotStats; } });
var protocol_1 = require("./protocol");
Object.defineProperty(exports, "spinBias", { enumerable: true, get: function () { return protocol_1.spinBias; } });
Object.defineProperty(exports, "ShotMode", { enumerable: true, get: function () { return protocol_1.ShotMode; } });
Object.defineProperty(exports, "DEFAULT_CONFIG", { enumerable: true, get: function () { return protocol_1.DEFAULT_CONFIG; } });
Object.defineProperty(exports, "MEVO_HOST", { enumerable: true, get: function () { return protocol_1.MEVO_HOST; } });
Object.defineProperty(exports, "MEVO_PORT", { enumerable: true, get: function () { return protocol_1.MEVO_PORT; } });
//# sourceMappingURL=index.js.map