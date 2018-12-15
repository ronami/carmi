declare namespace CarmiInternal {
    interface FunctionLibraryType { [name: string]: (...args: any[]) => any }

    interface Expression { }
    interface Looper<T> { }

    interface Projection<FunctionLibrary extends FunctionLibraryType> extends Expression {
        call<FunctionName extends keyof FunctionLibrary, Arguments>(func: FunctionName, ...args: Arguments[]):
            AsProjection<ReturnType<FunctionLibrary[FunctionName]>, FunctionLibrary>
        breakpoint(): this
        trace(logLevel?: StringArgument<'log' | 'trace' | 'error' | 'warn', FunctionLibrary>): this
    }
    
    type Primitive = string | number | boolean
    type UnionToIntersection<U> = 
      (U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never

    type IsEnum<T> = Primitive extends T ? false : true
    type ToTrueOrFalse<T> = UnionToIntersection<T> extends false ? false : true
    type Identical<A, B> = 
        IsEnum<A> extends true ? 
            IsEnum<B> extends true ? 
            ToTrueOrFalse<A extends B ? 
                    B extends A ? true : false 
                : false> : false : false 

    type MaybeIncludes<MaybeEnum, MaybePrimitive> =  ToTrueOrFalse<IsEnum<MaybeEnum> extends false ? true :
            MaybePrimitive extends Primitive ? (MaybeEnum extends MaybePrimitive ? true : false) : true>

    type Argument<T> = T | AsNative<T>
    interface PrimitiveProjection<NativeType, F extends FunctionLibraryType> extends Projection<F> {
        not(): 
            MaybeIncludes<NativeType, true> extends true ? 
                (MaybeIncludes<NativeType, false> extends true ? BoolProjection<boolean, F> :
                BoolProjection<false, F>) :
            MaybeIncludes<NativeType, false> extends true ? BoolProjection<true, F> : BoolProjection<boolean, F>

        ternary<Consequence extends Projection<F>, Alternate extends Projection<F>>(consequence: Argument<Consequence>, alternate: Argument<Alternate>): 
            Consequence | Alternate

        eq<Arg extends StringOrNumberArgument<NativeType, F>>(other: Arg): BoolProjection<boolean, F>
        gt(other: StringOrNumberArgument<NativeType, F>): BoolProjection<boolean, F>
        gte(other: StringOrNumberArgument<NativeType, F>): BoolProjection<boolean, F>
        lt(other: StringOrNumberArgument<NativeType, F>): BoolProjection<boolean, F>
        lte(other: StringOrNumberArgument<NativeType, F>): BoolProjection<boolean, F>
        recur<ValueType extends Projection<F>>(loop: Looper<ValueType>): ValueType
    }

    interface BoolProjection<NativeType, F extends FunctionLibraryType> extends PrimitiveProjection<NativeType, F> { }

    interface StringProjection<NativeType, F extends FunctionLibraryType> extends PrimitiveProjection<NativeType, F> {
        startsWith(s: StringArgument<string, F>): BoolProjection<boolean, F>
        endsWith(s: StringArgument<string, F>): BoolProjection<boolean, F>
        plus(num: StringArgument<string, F>): StringProjection<string, F>
        split(s: StringArgument<string, F>): ArrayProjection<StringProjection<string, F>, F>
        toUpperCase(): StringArgument<string, F>
        toLowerCase(): StringArgument<string, F>
        parseInt(radix?: number): NumberProjection<number, F>
        toNumber(): NumberProjection<number, F>
    }

    interface NumberProjection<NativeType, F extends FunctionLibraryType> extends PrimitiveProjection<NativeType, F> {
        minus(value: NumberArgument<number, F>): NumberProjection<number, F>
        mult(value: NumberArgument<number, F>): NumberProjection<number, F>
        plus(num: NumberArgument<number, F>): NumberProjection<number, F>
        plus(str: StringArgument<string, F>): StringProjection<string, F>
        div(value: NumberArgument<number, F>): NumberProjection<number, F>
        mod(value: NumberArgument<number, F>): NumberProjection<number, F>
        range(start?: NumberArgument<number, F>, skip?: NumberArgument<number, F>): ArrayProjection<NumberProjection<number, F>, F, NumberArgument<number, F>>
        floor(): NumberProjection<number, F>
        ceil(): NumberProjection<number, F>
        round(): NumberProjection<number, F>
    }


    type NumberArgument<NativeType extends number, F extends FunctionLibraryType> = NumberProjection<NativeType, F> | number
    type StringArgument<NativeType extends string, FunctionLibrary extends FunctionLibraryType> = StringProjection<NativeType, FunctionLibrary> | string
    type MapPredicate<ValueType, KeyType, ReturnType, ScopeType> =
        (value: ValueType, key: KeyType, scope: ScopeType) => ReturnType

    type RecursePredicate<ValueType, KeyType, ReturnType, ScopeType> =
        (loop: Looper<ReturnType>, value: ValueType, key: KeyType, scope: ScopeType) => ReturnType


    type StringOrNumberArgument<NativeType, F extends FunctionLibraryType> = StringArgument<NativeType extends string ? NativeType : never, F> | NumberArgument<NativeType extends number ? NativeType : never, F>

    interface AsNativeArray<ValueType> extends Array<AsNative<ValueType>> { }
    interface AsNativeObjectWithKnownProps<K extends {[name: string]: any}> { [name: string]: 
            AsNative<typeof name extends keyof K ? K[typeof name] : never> }
    interface AsNativeObjectWithUnknownProps<U> {[name: string]: U}

    interface AsNativeObject<K extends {[name: string]: any}, U> extends AsNativeObjectWithKnownProps<K>, AsNativeObjectWithUnknownProps<U> {}

    type AsNative<T> =
        T extends Projection<infer F> ? (
            T extends ArrayProjectionBase<infer ValueType, F> ? AsNativeArray<ValueType> :
            T extends ObjectProjection<infer K, infer U, F> ? AsNativeObject<K, U> :
            T extends PrimitiveProjection<F, infer NativeType> ? NativeType :
            never
        ) : T

    interface ArrayProjectionBase<ValueType extends Projection<F>, F extends FunctionLibraryType, ArraySize = number> extends Projection<F> {
        get(index: NumberArgument<number, F>): ValueType,
        size(): NumberProjection<ArraySize, F>
        map<ScopeType extends Projection<F>,
            RetType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<number, F>, RetType, ScopeType>, scope?: ScopeType): ArrayProjection<RetType, F>
    }

    type ProjectionArgument<ProjectionType> = ProjectionType | AsNative<ProjectionType>

    interface ArrayProjection<ValueType extends Projection<F>, F extends FunctionLibraryType, ArraySize = number> extends ArrayProjectionBase<ValueType, F, ArraySize> {
        any<ScopeType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<number, F>, BoolProjection<boolean, F>, ScopeType>, scope?: ScopeType): BoolProjection<boolean, F>
        keyBy<ScopeType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<number, F>, StringProjection<string, F> | NumberProjection<number, F>, ScopeType>, scope?: ScopeType): ObjectProjection<{}, ValueType, F>
        filter<ScopeType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<number, F>, BoolProjection<boolean, F>, ScopeType>, scope?: ScopeType): this
        find<ScopeType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<number, F>, BoolProjection<boolean, F>, ScopeType>, scope?: ScopeType): ValueType
        findIndex<ScopeType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<number, F>, BoolProjection<boolean, F>, ScopeType>, scope?: ScopeType): NumberProjection<number, F>
        assign<V extends Projection<F>, RetType = ValueType extends ObjectProjection<{}, V, F> ? ObjectProjection<{}, V, F> : never>(): RetType
        recursiveMap<ScopeType extends Projection<F>,
            RetType extends Projection<F>>(predicate: RecursePredicate<ValueType, NumberProjection<number, F>, RetType, ScopeType>, scope?: ScopeType): ArrayProjection<RetType, F>
        reduce<ScopeType extends Projection<F>,
            RetType extends Projection<F>>(predicate: (aggregate: RetType, value: ValueType, key: NumberProjection<number, F>) => RetType, initialValue: RetType, scope: ScopeType): RetType
        join(separator: StringArgument<string, F>): StringProjection<string, F>
        sum(): NumberProjection<number, F>
        append<T>(value: T):
            T extends ProjectionArgument<ValueType> ? this : T extends ObjectProjection<infer K, infer U, F> ? ArrayProjection<ValueType | T, F> : never
        concat<ArrayType>(...arrays: ArrayType[]):
            ArrayProjection<ValueType | (
                ArrayType extends ArrayProjection<infer OtherValueType, F> ? OtherValueType :
                ArrayType extends (infer NativeType)[] ? AsProjection<NativeType, F> : never
            ), F>
        head(): ValueType
        last(): ValueType
        reverse(): this
    }

    type Hint<H, V> = V

    interface ObjectProjection<Props extends { [name: string]: Projection<F> }, AdditionalProps extends Projection<F>|null, F extends FunctionLibraryType, 
        ValueType extends Projection<F> = Props[string] | (AdditionalProps extends null ? never : AdditionalProps), 
        KeyType = keyof Props | (AdditionalProps extends Projection<F> ? string : never)> extends Projection<F> {
        mapValues<ScopeType extends Projection<F>, RetType extends Projection<F>>(predicate: MapPredicate<ValueType, KeyType, RetType, ScopeType>, scope?: ScopeType):
            ObjectProjection<{ [name in keyof Props]: RetType }, AdditionalProps extends null ? null : RetType, F>

        mapKeys<ScopeType extends Projection<F>, RetType extends StringProjection<string, F> | string>(predicate: MapPredicate<ValueType, KeyType, RetType, ScopeType>, scope?: ScopeType):
            ObjectProjection<{ [name in RetType extends string ? RetType : never]: Props[keyof Props] | (AdditionalProps extends null ? never : AdditionalProps) }, AdditionalProps | Props[keyof Props], F>

        get<KeyType extends keyof Props | StringProjection<keyof Props, F> | string>(key: Hint<keyof Props|string, KeyType>):
            KeyType extends keyof Props ? Props[KeyType] :
            KeyType extends (string | number) ? AdditionalProps :
            (AdditionalProps | Props[string])

        anyValues<ScopeType extends Expression>(predicate: MapPredicate<ValueType, KeyType, BoolProjection<boolean, F>, ScopeType>, scope?: ScopeType): BoolProjection<boolean, F>
        filterBy<ScopeType extends Expression>(predicate: MapPredicate<ValueType, KeyType, BoolProjection<boolean, F>, ScopeType>, scope?: ScopeType): this
        includesValue(value: ValueType): BoolProjection<boolean, F>
        has(key: StringProjection<keyof Props|string, F>): BoolProjection<boolean, F>
        pick<Key extends string>(keys: Key[]): ObjectProjection<{[name in Key]: (Key extends keyof Props ? Props[Key] : (AdditionalProps extends Projection<F> ? AdditionalProps : never)}, null, F>
        groupBy<ScopeType extends Expression>(predicate: MapPredicate<ValueType, KeyType, StringProjection<string, F>, ScopeType>, scope?: ScopeType): ObjectProjection<{}, ObjectProjection<{}, ValueType, F>, F>
        values(): ArrayProjection<ValueType, F>
        assignIn<FirstObject extends object, NextObject extends object>(obj: FirstObject, args: NextObject[]): AsProjection<FirstObject & NextObject, F>
        setIn(path: ArrayProjection<StringProjection<string, F>, F>): ObjectProjection<{}, ValueType, F>
        keys(): ArrayProjection<StringProjection<KeyType, F>, F>
        recursiveMapValues<ScopeType extends Projection<F>, RetType extends Projection<F>>(predicate: MapPredicate<ValueType, KeyType, RetType, ScopeType>, scope?: ScopeType):
            ObjectProjection<{ [name in keyof Props]: RetType }, AdditionalProps extends null ? null : RetType, F>
    }

    class Token { private $type: string }
    type PathSegment = Token | string | number

    type KnownProps<O> = { [key in keyof O]: string | number extends key ? never : O[key] }
    type UnknownProps<O> = { [key in keyof O]: string | number extends key ? O[key] : never }

    interface AsArrayProjection<T, F extends FunctionLibraryType, ArraySize = number> extends ArrayProjection<AsProjection<T, F>, F, ArraySize> { }
    interface AsObjectProjection<T, F extends FunctionLibraryType, Known = KnownProps<T>, Unknown = UnknownProps<T>[keyof UnknownProps<T>]> extends
        ObjectProjection<{ [name in keyof Known]: AsProjection<Known[name], F> }, AsProjection<Unknown, F>, F> { }

    type AsProjection<NativeType, F extends FunctionLibraryType = {}> =
        NativeType extends Projection<F> ? Projection<F> :
        NativeType extends (infer Value)[] ? AsArrayProjection<Value, F, NativeType['length']> :
        NativeType extends { [name: string]: any } ? AsObjectProjection<NativeType, F> :
        NativeType extends string ? StringProjection<NativeType, F> :
        NativeType extends number ? NumberProjection<NativeType, F> :
        NativeType extends boolean ? BoolProjection<NativeType, F> :
        never


    type SetterExpression<Model, Path, F> = {}
    type SpliceExpression<Model, Path, F> = {}

    interface API<Schema, F extends FunctionLibraryType = {}> {
        root: AsProjection<Schema, F>
        chain<T>(t: T): AsProjection<T, F>
        and<Args extends Projection<F>[]>(...a: Args): Args
        or<Args extends Projection<F>[]>(...a: Args): Args
        setter<Path extends PathSegment[]>(path: Path): SetterExpression<Schema, Path, F>
        splice<Path extends PathSegment[]>(path: Path): SpliceExpression<Schema, Path, F>
        call<FunctionName extends keyof F, Args extends any[]>(func: FunctionName, ...args: Args): AsProjection<ReturnType<F[FunctionName]>>
        bind<FunctionName extends keyof F, BoundArgs extends Projection<F>, Args>(func: FunctionName, ...boundArgs: BoundArgs[]):
            (...args: Args[]) => ReturnType<F[FunctionName]>
        compile(transformations: { [name: string]: Projection<F> }, options?: object): string
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
