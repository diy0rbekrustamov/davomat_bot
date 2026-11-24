"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.byName = byName;
const names = new Intl.Collator('uz', { numeric: true, sensitivity: 'base' });
function byName(items, name, id) {
    const key = (value) => value.normalize('NFKC').trim().replace(/[‘’ʻʼ`]/g, "'").replace(/\s+/g, ' ');
    return items.sort((a, b) => names.compare(key(name(a)), key(name(b))) || id(a).localeCompare(id(b)));
}
