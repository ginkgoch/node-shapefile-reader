const fs = require('fs');
const { BufferReader, BufferWriter } = require('ginkgoch-buffer-io');

module.exports = class DbfHeader {
    constructor() {
        this.fileType = 0;
        this.year = 0;
        this.month = 0;
        this.day = 0;
        this.recordCount = 0;
        this.headerLength = 0;
        this.recordLength = 0;
        this.fields = []
    }

    read(fileDescriptor) {
        const headerBuffer = Buffer.alloc(32);
        fs.readSync(fileDescriptor, headerBuffer, 0, headerBuffer.length, 0);
        const headerBr = new BufferReader(headerBuffer);

        this.fileType = headerBr.nextInt8();
        this.year = headerBr.nextInt8();
        this.month = headerBr.nextInt8();
        this.day = headerBr.nextInt8();
        
        this.recordCount = headerBr.nextUInt32LE();
        this.headerLength = headerBr.nextUInt16LE();
        this.recordLength = headerBr.nextUInt16LE();

        this.fields = [];
        let position = headerBuffer.length;
        while(position < this.headerLength - 1) { 
            const fieldBuffer = Buffer.alloc(32);
            fs.readSync(fileDescriptor, fieldBuffer, 0, fieldBuffer.length, position);

            const field = { };
            field.name = fieldBuffer.slice(0, 11).toString().replace(/\0/g, '').trim();
            field.type = String.fromCharCode(fieldBuffer.readUInt8(11));
            if(field.type.toUpperCase() === 'C') {
                field.length = fieldBuffer.readUInt16LE(16);
            } else {
                field.length = fieldBuffer.readUInt8(16);
                field.decimal = fieldBuffer.readUInt8(17);
            }

            this.fields.push(field);
            position += fieldBuffer.length;
        }
    }

    write(fileDescriptor) {
        const headerBuffer = Buffer.alloc(32);
        const headerWriter = new BufferWriter(headerBuffer);
        headerWriter.writeInt8(this.fileType);
        headerWriter.writeInt8(this.year);
        headerWriter.writeInt8(this.month);
        headerWriter.writeInt8(this.day);
        headerWriter.writeUInt32(this.recordCount);
        headerWriter.writeUInt16(this.headerLength);
        headerWriter.writeUInt16(this.recordLength);
        fs.writeSync(fileDescriptor, headerBuffer, 0, headerBuffer.length, 0);

        let position = headerBuffer.length;
        for (let field of this.fields ) {
            let fieldBuffer = Buffer.alloc(32);
            const fieldWriter = new BufferWriter(fieldBuffer);

            const fieldNameBuffer = DbfHeader._chunkFieldNameBuffer(field.name);
            fieldWriter.writeBuffer(fieldNameBuffer);

            const fieldTypeCode = field.type.charCodeAt(0);
            fieldWriter.writeUInt8(fieldTypeCode);

            fieldWriter.seek(16);
            if (field.type.toUpperCase() === 'C') {
                fieldWriter.writeUInt16(field.length)
            } else {
                fieldWriter.writeUInt8(field.length);
                fieldWriter.writeUInt8(field.decimal)
            }

            fs.writeSync(fileDescriptor, fieldBuffer, 0, fieldBuffer.length, position);
            position += fieldBuffer.length

        }
    }

    static _chunkFieldNameBuffer(fieldName) {
        const fieldNameBuffer = Buffer.alloc(11);
        const sourceBuffer = Buffer.from(fieldName);
        sourceBuffer.copy(fieldNameBuffer, 0, 0, sourceBuffer.length > 11 ? 11 : sourceBuffer.length);
        return fieldNameBuffer;
    }
};