const clone = require('git-clone/promise');

module.exports = async function() {
    await clone("https://github.com/hex0perating/rice.git", "./src/rice");
}