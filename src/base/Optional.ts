

export default class Optional<T> {
    obj: T|undefined|null

    constructor(obj?: T|null) {
        this.obj = obj
    }

    get hasValue() {
        return this.obj !== undefined && this.obj !== null
    }

    get value() {
        return <T>this.obj
    }

    update(obj: T|undefined|null) {
        this.obj = obj
    }

    reset() {
        this.obj = undefined
    }
}