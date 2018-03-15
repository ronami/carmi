const { Expr, Token, Setter, Expression, SetterExpression, TopLevel } = require('./lang');
const _ = require('lodash');
const fs = require('fs');
const { splitSettersGetters, topologicalSortGetters, tagAllExpressions } = require('./expr-tagging');
let idx = 0;

class NaiveCompiler {
  constructor(model, name) {
    const { getters, setters } = splitSettersGetters(model);
    tagAllExpressions(getters);
    this.getters = getters;
    this.setters = setters;
    this.name = name || 'EssX';
  }

  get template() {
    return require('./templates/naive.js');
  }

  generateExpr(expr) {
    const currentToken = expr instanceof Expression ? expr[0] : expr;
    const tokenType = currentToken.$type;
    switch (tokenType) {
      case 'and':
        return (
          '(' +
          expr
            .slice(1)
            .map(e => this.generateExpr(e))
            .map(part => `(${part})`)
            .join('&&') +
          ')'
        );
      case 'or':
        return (
          '(' +
          expr
            .slice(1)
            .map(e => this.generateExpr(e))
            .map(part => `(${part})`)
            .join('||') +
          ')'
        );
      case 'not':
        return `!(${this.generateExpr(expr[1])})`;
      case 'eq':
        return `(${this.generateExpr(expr[1])}) === (${this.generateExpr(expr[2])})`;
      case 'root':
        return '$model';
      case 'get':
        return `${this.generateExpr(expr[2])}[${this.generateExpr(expr[1])}]`;
      case 'mapValues':
      case 'filterBy':
      case 'groupBy':
      case 'mapKeys':
        return `${tokenType}(${this.generateExpr(expr[1])}, ${this.generateExpr(expr[2])})`;
      case 'func':
        return currentToken.funcName;
      case 'arg0':
        return 'arg0';
      case 'arg1':
        return 'arg1';
      case 'topLevel':
        return `$${expr[1]}()`;
      default:
        return JSON.stringify(currentToken);
    }
  }

  buildDerived(name) {
    const prefix = name.indexOf('$') === 0 ? '' : `$res.${name} = `;
    return `${prefix} ${this.generateExpr(new Expression(TopLevel, name))};`;
  }

  buildSetter(setterExpr, name) {
    const args = setterExpr.filter(t => typeof t !== 'string').map(t => t.$type);
    const path = setterExpr.map(t => (t instanceof Token ? `[${t.$type}]` : `[${JSON.stringify(t)}]`)).join('');
    return `${name}:(${args.concat('value').join(',')}) => {
              $model${path} = value;
              recalculate();
          }`;
  }

  exprTemplatePlaceholders(expr, funcName) {
    return {
      ROOTNAME: expr[0].$rootName,
      FUNCNAME: funcName,
      EXPR1: () => this.generateExpr(expr[1]),
      EXPR: () => this.generateExpr(expr)
    };
  }

  appendExpr(acc, type, expr, funcName) {
    acc.push(
      this.mergeTemplate(
        this.template[type] || this.template[expr[0].$funcType],
        this.exprTemplatePlaceholders(expr, funcName)
      )
    );
  }

  buildExprFunctions(acc, expr, name) {
    if (!(expr instanceof Expression) || !expr[0]) {
      return;
    }
    const tokenType = expr[0].$type;
    switch (tokenType) {
      case 'func':
        expr[0].funcName = expr[0]['$funcId'];
        break;
    }

    _.forEach(expr.slice(1), this.buildExprFunctions.bind(this, acc));
    if (expr[0].funcName) {
      this.appendExpr(acc, tokenType, expr, expr[0].funcName);
    }
    if (typeof name === 'string') {
      this.appendExpr(acc, 'topLevel', expr, name);
    }

    return acc;
  }

  mergeTemplate(template, placeHolders) {
    return Object.keys(placeHolders)
      .reduce((result, name) => {
        const replaceFunc = typeof placeHolders[name] === 'function' ? placeHolders[name]() : () => placeHolders[name];
        const commentRegex = new RegExp('/\\*\\s*' + name + '\\s*\\*/');
        const dollarRegex = new RegExp('\\$' + name, 'g');
        return result.replace(commentRegex, replaceFunc).replace(dollarRegex, replaceFunc);
      }, template.toString())
      .replace(/function\s*\w*\(\)\s*\{\s*([\s\S]+)\}/, (m, i) => i);
  }

  compile() {
    return this.mergeTemplate(this.template.base, {
      NAME: this.name,
      ALL_EXPRESSIONS: () => _.reduce(this.getters, this.buildExprFunctions.bind(this), []).join('\n'),
      DERIVED: () =>
        topologicalSortGetters(this.getters)
          .map(this.buildDerived.bind(this))
          .join('\n'),
      SETTERS: () => _.map(this.setters, this.buildSetter.bind(this)).join(',')
    });
  }
}

module.exports = NaiveCompiler;