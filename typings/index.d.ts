declare namespace CarmiInternal {
    type FunctionLibraryType = {[name: string]: (...args: any[]) => any}
    
    interface Expression {}
    interface Looper<T> {}
    type StringArgument<FunctionLibrary extends FunctionLibraryType> = StringProjection<FunctionLibrary> | string
    type MapPredicate<ValueType, KeyType, ReturnType, ScopeType> =
        (value: ValueType, key: KeyType, scope: ScopeType) => ReturnType

    type RecursePredicate<ValueType, KeyType, ReturnType, ScopeType> =
        (loop: Looper<ValueType>, value: ValueType, key: KeyType, scope: ScopeType) => ReturnType

    interface Projection<FunctionLibrary extends FunctionLibraryType> extends Expression {
        call<FunctionName extends keyof FunctionLibrary, Arguments>(func: FunctionName, ...args: Arguments[]): 
            AsProjection<ReturnType<FunctionLibrary[FunctionName]>, FunctionLibrary>
        breakpoint(): this
        trace(logLevel?: StringArgument<FunctionLibrary>): this
    }

    interface PrimitiveProjection<F extends FunctionLibraryType> extends Projection<F> {
        not(): BoolProjection<F>
        ternary<Consequence extends Projection<F>, Alternate extends Projection<F>>(consequence: Consequence, alternate: Alternate): Consequence | Alternate
        eq(other: StringOrNumberArgument<F>): BoolProjection<F>
        gt(other: StringOrNumberArgument<F>): BoolProjection<F>
        gte(other: StringOrNumberArgument<F>): BoolProjection<F>
        lt(other: StringOrNumberArgument<F>): BoolProjection<F>
        lte(other: StringOrNumberArgument<F>): BoolProjection<F>
        recur<ValueType extends Projection<F>>(loop: Looper<ValueType>): ValueType
      }
      interface StringProjection<F extends FunctionLibraryType> extends PrimitiveProjection<F> {
        startsWith(s: StringArgument<F>): BoolProjection<F>
        endsWith(s: StringArgument<F>): BoolProjection<F>
        plus(num: StringArgument<F>): StringProjection<F>
        split(s: StringArgument<F>): ArrayProjection<StringProjection<F>, F>
        toUpperCase(): StringArgument<F>
        toLowerCase(): StringArgument<F>
        parseInt(radix?: number): NumberProjection<F>
        toNumber(): NumberProjection<F>
      }
        
      interface NumberProjection<F extends FunctionLibraryType> extends PrimitiveProjection<F> {
        minus(value: StringOrNumberArgument<F>): NumberProjection<F>
        mult(value: StringOrNumberArgument<F>): NumberProjection<F>
        plus(num: StringOrNumberArgument<F>): NumberProjection<F>
        plus(str: StringArgument<F>): StringProjection<F>
        div(value: StringOrNumberArgument<F>): NumberProjection<F>
        mod(value: StringOrNumberArgument<F>): NumberProjection<F>
        range(start?: NumberArgument<F>, skip?: NumberArgument<F>): ArrayProjection<NumberProjection<F>, F, NumberArgument<F>>
        floor(): NumberProjection<F>
        ceil(): NumberProjection<F>
        round(): NumberProjection<F>
      }

      
      type NumberArgument<F extends FunctionLibraryType> = NumberProjection<F> | number
      type StringOrNumberArgument<F extends FunctionLibraryType> = StringArgument<F> | NumberArgument<F>
      interface BoolProjection<F extends FunctionLibraryType> extends PrimitiveProjection<F> { }

      interface AsNativeArray<ValueType, F extends FunctionLibraryType> extends Array<AsNative<ValueType>> {}
      type AsNative<T> = 
        T extends Projection<infer F> ? (
            T extends ArrayProjectionBase<infer ValueType, F> ? AsNativeArray<ValueType, F> :
            T extends StringProjection<F> ? string :
            T extends NumberProjection<F> ? number :
            T extends BoolProjection<F> ? boolean :
            never
        ) : T

        interface ArrayProjectionBase<ValueType extends Projection<F>, F extends FunctionLibraryType> extends Projection<F> {
            get(index: StringOrNumberArgument<F>): ValueType,
            size(): NumberProjection<F>
            map<ScopeType extends Projection<F>,
                RetType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<F>, RetType, ScopeType>, scope?: ScopeType): ArrayProjection<RetType, F>
        }

       type ProjectionArgument<ProjectionType> = ProjectionType | AsNative<ProjectionType>

       interface ArrayProjection<ValueType extends Projection<F>, F extends FunctionLibraryType, ValueArg = ProjectionArgument<ValueType>> extends ArrayProjectionBase<ValueType, F> {
        any<ScopeType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<F>, BoolProjection<F>, ScopeType>, scope?: ScopeType): BoolProjection<F>
        keyBy<ScopeType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<F>, StringProjection<F> | NumberProjection<F>, ScopeType>, scope?: ScopeType): ObjectProjection<{}, ValueType, F>
        filter<ScopeType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<F>, BoolProjection<F>, ScopeType>, scope?: ScopeType): this
        find<ScopeType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<F>, BoolProjection<F>, ScopeType>, scope?: ScopeType): ValueType
        findIndex<ScopeType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<F>, BoolProjection<F>, ScopeType>, scope?: ScopeType): NumberProjection<F>
        assign<V extends Projection<F>, RetType = ValueType extends ObjectProjection<{}, V, F> ? ObjectProjection<{}, V, F> : never>(): RetType
        recursiveMap<ScopeType extends Projection<F>,
            RetType extends Projection<F>>(predicate: RecursePredicate<ValueType, NumberProjection<F>, RetType, ScopeType>, scope?: ScopeType): ArrayProjection<RetType, F>
        reduce<ScopeType extends Projection<F>,
            RetType extends Projection<F>>(predicate: (aggregate: RetType, value: ValueType, key: NumberProjection<F>) => RetType, initialValue: RetType, scope: ScopeType): RetType
        join(separator: StringArgument<F>): StringProjection<F>
        sum(): NumberProjection<F>
        append<T>(value: T): 
            T extends ValueArg ? this : T extends ObjectProjection<infer K, infer U, F> ? ArrayProjection<ValueType | T, F> : never
        concat<ArrayType>(...arrays: ArrayType[]): 
            ArrayProjection<ValueType | (
                ArrayType extends ArrayProjection<infer OtherValueType, F> ? OtherValueType :
                ArrayType extends (infer NativeType)[] ? AsProjection<NativeType, F> : never
            ), F>
      }

      interface ObjectProjection<Props extends {[name: string]: Projection<F>}, AdditionalProps extends Projection<F>, F extends FunctionLibraryType, ValueType extends Projection<F> = AdditionalProps | Props[string]> extends Projection<F> {
        mapValues<ScopeType extends Projection<F>, RetType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<F>, RetType, ScopeType>, scope?: ScopeType):          
            ObjectProjection<{[name in keyof Props]: RetType}, AdditionalProps extends null ? null : RetType, F>      

        mapKeys<ScopeType extends Projection<F>, RetType extends StringProjection<F> | string>(predicate: MapPredicate<ValueType, StringProjection<F> | NumberProjection<F>, RetType, ScopeType>, scope?: ScopeType): 
            ObjectProjection<{[name in RetType extends string ? RetType : never]: Props[keyof Props] | AdditionalProps}, AdditionalProps | Props[keyof Props], F>

        get<KeyType extends StringOrNumberArgument<F>>(key: KeyType): 
            KeyType extends keyof Props ? Props[KeyType] :
            KeyType extends (string|number) ? AdditionalProps :
            (AdditionalProps | Props[string])

        anyValues<ScopeType extends Expression>(predicate: MapPredicate<ValueType, StringProjection<F>, BoolProjection<F>, ScopeType>, scope?: ScopeType): BoolProjection<F>
        filterBy<ScopeType extends Expression>(predicate: MapPredicate<ValueType, StringProjection<F>, BoolProjection<F>, ScopeType>, scope?: ScopeType): this
        includesValue(value: ValueType): BoolProjection<F>
        has(key: StringProjection<F>): BoolProjection<F>
        pick(keys: (string | keyof Props)[]): this
        groupBy<ScopeType extends Expression>(predicate: MapPredicate<ValueType, StringProjection<F> | NumberProjection<F>, StringProjection<F> | NumberProjection<F>, ScopeType>, scope?: ScopeType): ObjectProjection<{}, ObjectProjection<{}, ValueType, F>, F>
        values(): ArrayProjection<ValueType, F>
        assignIn<FirstObject extends object, NextObject extends object>(obj: FirstObject, args: NextObject[]) : AsProjection<FirstObject & NextObject, F>
        setIn(path: ArrayProjection<StringProjection<F>, F>) : ObjectProjection<{}, ValueType, F>
        keys(): ArrayProjection<StringProjection<F>, F>
        recursiveMapValues<ScopeType extends Projection<F>, RetType extends Projection<F>>(predicate: MapPredicate<ValueType, NumberProjection<F>, RetType, ScopeType>, scope?: ScopeType):          
            ObjectProjection<{[name in keyof Props]: RetType}, AdditionalProps extends null ? null : RetType, F>
      }

    class Token {private $type: string}
    type PathSegment = Token | string | number
    
    type KnownProps<O> = {[key in keyof O]: string|number extends key ? never : O[key]}
    type UnknownProps<O> = {[key in keyof O]: string|number extends key ? O[key] : never}

    interface AsArrayProjection<T, F extends FunctionLibraryType> extends ArrayProjection<AsProjection<T, F>, F> { }
    interface asObjectProjection<T, F extends FunctionLibraryType, Known = KnownProps<T>, Unknown = UnknownProps<T>[keyof UnknownProps<T>]> extends 
        ObjectProjection<{[name in keyof Known]: AsProjection<Known[name], F>}, AsProjection<Unknown, F>, F> { }

    type AsProjection<NativeType, F extends FunctionLibraryType = {}> =
        NativeType extends Projection<F> ? Projection<F> :
        NativeType extends (infer Value)[] ? AsArrayProjection<Value, F> :
        NativeType extends {[name: string]: any} ? asObjectProjection<NativeType, F> :
        NativeType extends string ? StringProjection<F> :
        NativeType extends number ? NumberProjection<F> :
        NativeType extends boolean ? BoolProjection<F> :
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
        call<FunctionName extends keyof F, Args extends any[]>(func: FunctionName, ...args: Args) : AsProjection<ReturnType<F[FunctionName]>>
        bind<FunctionName extends keyof F, BoundArgs extends Projection<F>, Args>(func: FunctionName, ...boundArgs: BoundArgs[]) : 
            (...args: Args[]) => ReturnType<F[FunctionName]>
        compile(transformations: {[name: string]: Projection<F>}, options?: object): string
        arg0: Token
        arg1: Token
        arg2: Token
        key: Projection<F>
        val: Projection<F>        
    }

}

declare namespace CarmiPublic {
    export const root: any
    export function withSchema<Schema, F extends CarmiInternal.FunctionLibraryType = {}>(model?: Schema, functions?: F) : CarmiInternal.API<Schema, F>
}

export = CarmiPublic

//export type CarmiWithSchema<Schema = any, F extends CarmiInternal.FunctionLibraryType = {}> = CarmiInternal.API<Schema, F>
