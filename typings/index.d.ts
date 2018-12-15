declare namespace CarmiInternal {
    interface FunctionLibraryType { [name: string]: (...args: any[]) => any }

    interface Expression { }
    interface Looper<T> { }
    type AnyPrimitive = string | number | boolean

    type UnionToIntersection<U> = 
      (U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never

    interface Projection<T, F extends FunctionLibraryType> extends P<T, F> {}
    type Argument<T, F extends FunctionLibraryType> = T | Projection<T, F>

    interface P<This, 
                F extends FunctionLibraryType,
                Primitive = (This extends string ? string : This extends number ? number : This extends boolean ? boolean : never),
                PrimitiveArgument = Argument<AnyPrimitive, F>,
                Key = keyof This,
                IsNonObjectArray = (This extends any[] ? false : This extends object ? true : false),
                Value = This[keyof This],
                ValueProjection = Projection<Value, F>
                > extends Expression {

        // Any
        call<FunctionName extends keyof F, Arguments>(func: FunctionName, ...args: Arguments[]): P<ReturnType<F[FunctionName]>, F>
        breakpoint(): this
        trace(logLevel?: 'log' | 'trace' | 'error' | 'warn'): this

        // Primitive
        not(): P<boolean, F>
        ternary<Consequence, Alternate>(consequence: Argument<Consequence, F>, alternate: Argument<Alternate, F>): Consequence | Alternate
        eq(other: PrimitiveArgument): P<boolean, F>
        gt(other: PrimitiveArgument): P<boolean, F>
        gte(other: PrimitiveArgument): P<boolean, F>
        lt(other: PrimitiveArgument): P<boolean, F>
        lte(other: PrimitiveArgument): P<boolean, F>
        recur<ValueType>(loop: Looper<ValueType>): ValueType

        // Number
        minus(value: Argument<number, F>): This extends number ? P<number, F> : never
        mult(value: Argument<number, F>): This extends number ? P<number, F> : never
        plus(num: Argument<number, F>): This extends number ? P<number, F> : never
        plus(str: Argument<string, F>): This extends number ? P<number, F> : never
        div(value: Argument<number, F>): This extends number ? P<number, F> : never
        mod(value: Argument<number, F>): This extends number ? P<number, F> : never
        range(start?: Argument<number, F>, skip?: Argument<number, F>): P<number[], F>
        floor(): This extends number ? P<number, F> : never
        ceil(): This extends number ? P<number, F> : never
        round(): This extends number ? P<number, F> : never

        // String
        startsWith(s: Argument<string, F>): This extends string ? P<boolean, F> : never
        endsWith(s: Argument<string, F>): This extends string ? P<boolean, F> : never
        plus(num: Argument<string, F>): This extends string ? P<string, F> : never
        split(s: Argument<string, F>): This extends string ? P<string[], F> : never 
        toUpperCase(): This extends string ? P<string, F> : never
        toLowerCase(): This extends string ? P<string, F> : never
        parseInt(radix?: number): This extends string ? P<number, F> : never
        toNumber(): This extends string ? P<number, F> : never

        // Array/object
        get<K extends string>(key: K): Key extends string ? K extends keyof This ? P<This[K], F> : never : never
//        get(key: P<Key, F>): P<This[keyof This], F>
        size(): P<This extends any[] ? This['length'] : This extends object ? P<number, F> : never, F>,

        // Array
        assign(): This extends any[] ? UnionToIntersection<Value> : never
        head(): This extends any[] ? P<Value, F> : never
        last(): This extends any[] ? P<Value, F> : never
        sum(): This extends number[] ? P<number, F> : never
        join(separator: Argument<string, F>): This extends string[] ? P<string, F> : never
        reverse(): This extends any[] ? P<Value[], F> : never
        map<Scope, Ret>(functor: (value: ValueProjection, key?: KeyProjection, scope?: Scope) => Argument<Ret, F>, scope?: Scope) : This extends any[] ? P<Ret[], F> : never
        any<Scope>(functor: (value: ValueProjection, key?: KeyProjection, scope?: Scope) => Argument<boolean, F>, scope?: Scope) : This extends any[] ? P<boolean, F> : never
        keyBy<Scope, Ret extends Argument<string, F>>(functor: (value: Value, key?: Key, scope?: Scope) => Argument<Ret, F>, scope?: Scope) : This extends any[] ?
            Ret extends string ? {[name in Ret]: Value} : {[name: string]: Value} : never
        filter<Scope>(functor: (value: ValueProjection, key?: KeyProjection, scope?: Scope) => Argument<boolean, F>, scope?: Scope) : This extends any[] ? P<Value[], F> : never
        find<Scope>(functor: (value: ValueProjection, key?: KeyProjection, scope?: Scope) => Argument<boolean, F>, scope?: Scope) : This extends any[] ? Value : never
        findIndex<Scope>(functor: (value: ValueProjection, key?: KeyProjection, scope?: Scope) => Argument<boolean, F>, scope?: Scope) : This extends any[] ? P<number, F> : never
        reduce<Ret>(functor: (aggregate: Ret, value?: Value, key?: KeyProjection) => Argument<Ret, F>, initialValue?: Ret): This extends any[]? Ret : never
        append<T>(value: T) : This extends any[] ? P<(Value|T)[], F> : never
        concat<T>(...arrays: T[][]) : This extends any[] ? P<(Value|T)[], F> : never
        recursiveMap<Scope, Ret>(functor: (loop: Looper<Ret>, value?: Value, key?: Key, scope?: Scope) => Argument<Ret, F>, scope?: Scope): This extends any[] ? P<Ret[], F> : never
        includes(value: Value): This extends any[] ? P<boolean, F> : never

        // Object
        keys(): IsNonObjectArray extends true ? This extends any[] ? never : P<Key[], F> : never
        values(): IsNonObjectArray extends true ? This extends any[] ? never : P<Value[], F>: never
        has(key: Argument<string, F>): IsNonObjectArray extends true ? This extends any[] ? never : 
            typeof key extends string ? typeof key extends Key ? P<boolean, F> : P<false, F> :
            never: never
        includesValue(value: Value): IsNonObjectArray extends true ? P<boolean, F> : never
        filterBy<Scope>(functor: (value: ValueProjection, key?: KeyProjection, scope?: Scope) => Argument<boolean, F>, scope?: Scope) : IsNonObjectArray extends true ? this : never
        pick<K extends Key>(keys: K[]): Value extends object ? K extends keyof This ? P<{[key in K]: This[K]}, F> : never : never
        mapValues<Scope, Ret>(functor: (value: ValueProjection, key?: KeyProjection, scope?: Scope) => Argument<Ret, F>, scope?: Scope) : Key extends string ? P<{[name in Key]: Ret}, F> : never
        mapKeys<Scope, Ret extends Argument<string, F>>(functor: (value: Value, key?: Key, scope?: Scope) => Argument<Ret, F>, scope?: Scope) : 
        IsNonObjectArray extends true ? P<{[key in Ret extends string ? Ret : string]: Value}, F> : never
        anyValues<Scope>(functor: (value: ValueProjection, key?: KeyProjection, scope?: Scope) => Argument<boolean, F>, scope?: Scope) : IsNonObjectArray extends true ? P<boolean, F> : never
        groupBy<Scope, Ret>(functor: (value: ValueProjection, key?: KeyProjection, scope?: Scope) => Argument<Ret, F>, scope?: Scope) : Key extends string ?  {[key in Ret extends string ? Ret : string]: Value} : never
        assignIn<V extends object>(value: Argument<V, F>): IsNonObjectArray extends true ? P<This & V, F> : never
        setIn(path: string[]): this
        recursiveMapValues<Scope, Ret>(functor: (loop: Looper<Ret>, value?: Value, key?: Key, scope?: Scope) => Argument<Ret, F>, scope?: Scope): Key extends string ? P<{
            Key: Ret 
        }, F> : never
    }

    class Token { private $type: string }
    type PathSegment = Token | string | number

    type SetterExpression<Model, Path, F> = {}
    type SpliceExpression<Model, Path, F> = {}

    interface API<Schema, F extends FunctionLibraryType = {}> {
        root: P<Schema, F>
        chain<T>(t: T): P<T, F>
        and<Args>(...a: Args[]): Args
        or<Args>(...a: Args[]): Args
        setter<Path extends PathSegment[]>(path: Path): SetterExpression<Schema, Path, F>
        splice<Path extends PathSegment[]>(path: Path): SpliceExpression<Schema, Path, F>
        call<FunctionName extends keyof F, Args extends any[]>(func: FunctionName, ...args: Args): P<ReturnType<F[FunctionName]>, F>
        bind<FunctionName extends keyof F, BoundArgs, Args>(func: FunctionName, ...boundArgs: BoundArgs[]): (...args: Args[]) => ReturnType<F[FunctionName]>
        compile(transformations: object, options?: object): string
        arg0: Token
        arg1: Token
        arg2: Token
    }

    
}

declare namespace CarmiPublic {
    export const root: any
    export function withSchema<Schema, F extends CarmiInternal.FunctionLibraryType = {}>(model?: Schema, functions?: F): CarmiInternal.API<Schema, F>
}

export = CarmiPublic

//export type CarmiWithSchema<Schema = any, F extends CarmiInternal.FunctionLibraryType = {}> = CarmiInternal.API<Schema, F>
