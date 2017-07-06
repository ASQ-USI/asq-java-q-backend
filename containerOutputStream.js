/**
 * Module for creating custom writable streams in order to get the stdout and stderr from the containers
 */

const stream = require('stream');
const util = require('util');
const Writable = stream.Writable;


function OutputStream(options) {
    if (!(this instanceof OutputStream)) return new OutputStream(options);

    Writable.call(this, options);
    this.memStore = new Buffer('');

    this.toString = function () {
        return this.memStore.toString()
    }
}

util.inherits(OutputStream, Writable);

OutputStream.prototype._write = function (chunk, enc, cb) {

    const buffer = (Buffer.isBuffer(chunk)) ? chunk : new Buffer(chunk, enc);
    this.memStore = Buffer.concat([this.memStore, buffer]);
    cb();
};

module.exports = OutputStream;