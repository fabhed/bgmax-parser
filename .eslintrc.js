module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true
    },
    "extends": "airbnb-base",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly",
        "test": "readonly",
        "expect": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "rules": {
        "no-extend-native": 0,
        "consistent-return": 0,
        "no-param-reassign": 0,
        "func-names": 0,
        "no-console": 0
    }
};