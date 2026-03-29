module.exports = {
    "rules": {
        "import/extensions": "off",
        "eqeqeq": ["error", "smart"], // allow the smart "null-and-undefined" check ==/!= null
        "no-eq-null": "off", // We use rule "eqeqeq" instead
        "@typescript-eslint/naming-convention": "off",
        "radix": ["error", "as-needed"], // enforcing omission instead of presence of the 10 radix
        "unicorn/no-array-reduce": "off",
        "unicorn/expiring-todo-comments": "off",
        "unicorn/no-array-callback-reference": "off",
        "n/file-extension-in-import": "off"
    }
};