/*/---------------------------------------------------------/*/
/*/ Craydent LLC craydent-noof-v0.2.3                       /*/
/*/ Copyright 2011 (http://craydent.com/about)              /*/
/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
/*/ (http://craydent.com/license)                           /*/
/*/---------------------------------------------------------/*/
/*/---------------------------------------------------------/*/
/*
 * To Do:
 *  make private variables and methods only availabe to the declaring class
 *  create final property and methods to prevent override
 *  create static methods
 *  create aliasing for methods and vars
 *  create abstract property and methods to ensure implementation
 */
var $c = require('craydent/noConflict');
$g = global;

$g.GarbageCollector = [];
var modifiers = ['private','protected','public','this'];
var modAccessible = ['public','this'];
var modInAccessible = ['private','protected'];
var defaultCode = "self.destruct = self.destruct && $c.isFunction(self.destruct) ? self.destruct : function(){};" +
    "self.construct && $c.isFunction(self.construct) && self.construct.apply(self,arguments);" +
    "$g.GarbageCollector.push(this);return this;";
function __addprotos (f) {
    f.extendsFrom = extendsFrom;
    f.implementsInterface = implementsInterface;
    return f;
}
function __checkDefined (modifiers, spec) {
    //var tName = spec.__name;
    var args = [],types = [], any = {any:1,Object:1};
    if (spec.__args) {
        for (var i = 0, len = spec.__args.length; i < len; i++) {
            args.push(spec.__args[i].name);
            types.push(spec.__args[i].type);
        }
    }
    var len = args.length;

    for (var modifier in modifiers) {
        if (!modifiers.hasOwnProperty(modifier)){
            continue;
        }
        var filtered = modifiers[modifier].filter(function (item){
            if (spec.__args && spec.__args.length) {
                if (item.__args.length != len || item.__name != spec.__name) { return false; }
                for (var i = 0; i < len; i++) {
                    if (!(types[i] in any) && (types[i] != item.__args[i].type/* || args[i] != item.__args[i].name*/)) {
                        return false;
                    } else if (!(types[i] in any) && args[i] != item.__args[i].name) {
                        return false;
                    }
                }
                return true;
                //return $c.equals($c.getParameters(item[item.__name]), args);
                //return $c.equals(item.__args, spec.__args);
            }
            return spec.__name == item.__name;
            //return item.__name == tName ;
        });
        if(!$c.isEmpty(filtered)) {
            return filtered;
        }
    }
    return false;
}
function __getClassProperties (cls) {
    return (__removeComments(cls).match(RegExp('(this|private|protected|public)\.(.|\n|\r\n)*?;','g'))||[]).map(function (p) {
        var prop = p.replace(/\./g, '_____').replace(';',''),
            index = -1;
        if ((index = prop.indexOf("=")) != -1) {
            prop = prop.substring(0,index).trim();
        }

        if (prop.indexOf("this_____") == 0) {
            prop = prop.replace('this','public');
        }
        if (!$c.tryEval("typeof " + prop)) {
            return undefined;
        }
        return prop;
    });
}
function __getFuncArgs (func) {
    return func.toString().trim().replace(/\s*/gi, '').replace(/.*?\((.*?)\).*/, '$1').split(',');
}
function __getUnformattedPropertyName(prop, details) {
    var arr = prop.split('_____');
    details = details || {};
    details.accessModifier = arr[0];
    if (arr.length > 1 && arr[1] == "method") {
        details.isMethod = true;
        arr.splice(0,2);
        return arr.join('_____');
    }

    return arr.splice(1,arr.length).join('_____');
}
function __processBlocks(blocks, a, abstractClass, log) {
    if (!abstractClass) {
        var methods = [];
        for (var i = 0, len = blocks.length; i < len; i++) {
            if (blocks[i].startsWith("var ")) {//private var(s)

                var block = blocks[i].replace("var ",'').slice(0,-1);
                var vars = [];
                var parts = block.split(',');
                var blk = "";
                for (var j = 0, jlen = parts.length; j < jlen; j++) {
                    blk += parts[j];
                    var good = false;
                    try {
                        eval('var ' + blk);
                        good = true;
                    } catch(e){
                        good = e.toString().indexOf('SyntaxError') == -1;
                    }
                    if (good) {
                        var vparts = blk.split('=');
                        var val = vparts.splice(1).join('=').trim();
                        vars.push([vparts[0].trim(),val]);
                        blk = "";
                    }
                }
                for (var j = 0, jlen = vars.length; j < jlen; j++) {
                    var item = {};
                    var parg = __processParameter(vars[j][0]);
                    //item.__name = vars[j][0];
                    item.__name = parg.name;
                    item.__type = parg.type;
                    item.__code = parg.code;
                    item[item.__name] = item.__value = vars[j][1];
                    a.properties["private"].push(item);
                }
            } else if ($c.startsWithAny(blocks[i],"this.","public.","private.","protected.") && !$c.startsWithAny(blocks[i],"this.__define","public.__define","private.__define","protected.__define")) {
                var parts = blocks[i].match(/^(this|private|protected|public)\.([\s\S]*?)(?:=\s*?([\s\S]*;)|;)/);
                if (parts && parts.length == 4) { // is some kind of class property [0]=>block [1] => access modifier [2] => property [3] => value
                    var part = {}, value;
                    //part[parts[2]] = parts[3];
                    value = parts[3] && ($c.tryEval(parts[3]) || $c.tryEval(parts[3].slice(0,-1)));
                    //part.__name = parts[2].trim();
                    if (parts[2].startsWith('method.') /*|| (value && value.isFunction())*/) {// this is a methodvar name = parts[2].replace('method.','');
                        var mparts = parts[2].match(/method\.([^\s]*?)\s*(?:\((.*?)\))?\s*$/), afunc;

                        var type_and_name = [];
                        mparts[1] && (type_and_name = mparts[1].split('.'));

                        var method_has_type_defined = type_and_name.length != 1;

                        delete part[parts[2]];
                        part.__name = !method_has_type_defined ? type_and_name[0] : type_and_name[1];
                        part.__return_type = method_has_type_defined ? type_and_name[0] : "any";
                        part[part.__name] = part.__value = parts[3];
                        part.__args = [];

                        var index, args = null;
                        if ((index = part.__name.indexOf('(')) != -1) {
                            args = part.__name.substring(index + 1, part.__name.length - 1).split(',');
                            part.__name = part.__name.substring(0,index);
                        } else if (mparts[2]) {
                            args = mparts[2].split(',');
                        }


                        afunc = $c.strip(parts[3] || (parts[3] = "function(){};"),';');
                        var fargs = args || $c.getParameters(afunc);
                        var extra = "",parameters = [];
                        for (var k = 0, klen = fargs.length; k < klen; k++) {
                            var farg = __processParameter(fargs[k]);
                            parameters.push(farg.name);
                            extra += farg.code;
                            part.__args.push(farg);
                        }
                        if (extra) {
                            var regex = /function\s*(\*?)\s*\(.*?\)\s*?\{/, replacer = "function$1 ("+parameters.join(',')+"){";
                            value = $c.tryEval(afunc.replace(regex,replacer + extra));
                            parts[3] = parts[3].replace(regex,replacer)
                        }

                        var index = -1;
                        if ((index = methods.indexOf(part.__name)) == -1) {
                            methods.push(part.__name);
                        } else {
                            var amods = $c.contains(modAccessible,parts[1]) ? modAccessible : modInAccessible;
                            for (var j = 0, jlen = amods.length; j < jlen; j++) {
                                var modifier = amods[j];
                                do {
                                    var mindex = $c.indexOfAlt(a.methods[modifier],part.__name,function(item){return item.__name;});
                                    if (mindex == -1) { continue; }
                                    if ($c.equals(a.methods[modifier][mindex].__args, part.__args)) {
                                        var err = 'Duplicate Error: ' + part.__name + ' has been already declared with the same signature.';
                                        console.error(err);
                                        throw err;
                                    }
                                    a.methods[modifier][mindex].__overloaded = part.__overloaded = true;
                                } while ((index = methods.indexOf(part.__name, index + 1)) != -1);
                            }
                        }

                        a.methods[parts[1]].push(part);
                    } else {// this is a property
                        var parg = __processParameter(parts[2].trim());
                        part.__name = parg.name;
                        part.__type = parg.type;
                        part.__code = parg.code;
                        if (value && $c.isFunction(value)) {
                            part.__args = [];
                            var index = -1;
                            if ((index = methods.indexOf(part.__name)) == -1) {
                                methods.push(part.__name);
                            } else {
                                for (var j = 0, jlen = modifiers.length; j < jlen; j++) {
                                    var modifier = modifiers[j];
                                    do {
                                        if ($c.isEqual(a.methods[modifier][index].__args, part.__args)
                                            && ($c.contains(modAccessible,modifier) && $c.contains(modAccessible,parts[1]) || $c.contains(modInAccessible,modifier) && $c.contains(modInAccessible,parts[1]))) {
                                            var err = 'Duplicate Error: ' + part.__name + ' has been already declared with the same signature.';
                                            console.error(err);
                                            throw err;
                                        }
                                        a.methods[modifier][index].__overloaded = part.__overloaded = true;
                                    } while ((index = methods.indexOf(part.__name, index + 1)) != -1);
                                }
                            }
                            a.methods[parts[1]].push(part);
                        } else {
                            a.properties[parts[1]].push(part);
                        }
                    }

                    part[part.__name] = part.__value = parts[3];
                    blocks[i] = (parts[1] == "private" || parts[1] == "protected"?"var ":"this.") +
                        part.__name + (parts[3] ? " =" + parts[3] : "")+";";
                }
            }
        }
    } else {
        var aMethods = abstractClass.methods,
            aProperties = abstractClass.properties;

        for (var modifier in aMethods) {
            var methods = aMethods[modifier];
            for (var i = 0, len = methods.length; i < len; i++){
                var methodName = methods[i].__name.trim(),
                    method = {__name:methodName};
                method[methodName] = method.__value = methods[i][methodName];
                a.methods[modifier].push(method);
            }
        }

        for (var modifier in aProperties) {
            var properties = aProperties[modifier];
            for (var i = 0, len = properties.length; i < len; i++){
                var propertyName = properties[i].__name.trim(),
                    property = {__name:propertyName};
                property[propertyName] = property.__value = properties[i][propertyName];
                a.properties[modifier].push(property);

                var value = $c.tryEval(properties[i][propertyName]);
                if (value && $c.isFunction(value)) {
                    a.methods[modifier].push(property);
                }
            }
        }

    }
}
function __processClass(cls) {
    var clsStr = __removeComments(cls);
    var clsName = cls.name;
    var regexp = new RegExp('\\s*?function\\s*?'+clsName+'\\s*?\\([\\s\\S]*?\\)[\\s\\S]*?\\{');
    var lastIndex = clsStr.lastIndexOf('}');
    if (clsStr[lastIndex-1] == ';') {
        lastIndex--;
    }
    var lines = clsStr.substring(0,lastIndex).replace(regexp, '').split(';').map(function(item){return item.trim();});
    var fullLines = [];
    for (var i = 0, len = lines.length, line = lines[i]; i < len; line = lines[++i]) {
        var lbraceCount = line.replace(/[^{]/g, "").length,
            rbraceCount = line.replace(/[^}]/g, "").length,
            lparenCount = line.replace(/[^(]/g, "").length,
            rparenCount = line.replace(/[^)]/g, "").length;
        if (lbraceCount == rbraceCount && lparenCount == rparenCount) {
            if (!line) {
                continue;
            }
            fullLines.push(line+";");
        } else {
            while ((lbraceCount != rbraceCount || lparenCount != rparenCount) && i < len) {
                line += ";"+lines[++i];
                lbraceCount = line.replace(/[^{]/g, "").length;
                rbraceCount = line.replace(/[^}]/g, "").length;
                lparenCount = line.replace(/[^(]/g, "").length;
                rparenCount = line.replace(/[^)]/g, "").length;
            }
            if (lbraceCount != rbraceCount ||  lparenCount != rparenCount) {
                var err = "syntax problem " + clsName;
                console.error(err);
                throw err;
            }
            if (!line) {
                continue;
            }
            fullLines.push(line+";");
        }
    }
    return $c.condense(fullLines);
}
function __processParameter (parameter) {
    var pval,pclass = "any",extra = "";
    if ($c.contains(parameter,'=')) {
        var varval = parameter.split('=');
        parameter = varval[0];
        pval = varval[1];
    }
    var strongvar = parameter;
    var fargparts = parameter.split('.');
    if (fargparts.length > 2) {
        var err = "malformatted argument: " + parameter;
        console.error(err);
        throw err;
    } else if (fargparts.length == 2) {
        pclass = (fargparts[0] || "").trim();
        parameter = (fargparts[1] || "").trim();
    }
    if (pval) {
        extra += "this." + parameter + " = " + "this." + parameter + " || " + pval;
    }
    if (pclass && pclass != "any") {
        var typeError = "'Invalid Type: " + parameter + " must be type "+pclass+"'";
        extra += "if (!$c.isNull(this." + parameter + ") && " + "this." + parameter + ".constructor != " + pclass + ") { throw new Error("+typeError+");}";
        extra += "var ___"+parameter+" = this."+parameter+";";
        extra += "this.__defineSetter__('"+parameter+"', function(val){ if (!$c.isNull(val) && val.constructor != " + pclass + ") { throw new Error('Invalid Type: " + parameter + " must be type "+pclass+"'); }___"+parameter+" = val; });";
        extra += "this.__defineGetter__('"+parameter+"', function(){ return ___"+parameter+"; });";
    }
    return {name:parameter,type:pclass,code:extra};

}
function __removeComments(cls){
    return cls.toString().replace(/\/\/[\s\S]*?\n/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
}
function __render_methods(context, func, body) {
    var fname = func.__name;
    var rtype = func.__return_type;
    var fvalue = func.__value.toString();
    var type_check_code = rtype == "any" ? " return rtn;" : "if ($c.isNull(rtn) || \"" + rtype + "\" != $c.getName(rtn.constructor)) { " +
        "   throw 'Returned value for " + fname + " was not of type " + rtype + "';" +
        "} return rtn;";
    //if the function is overloaded
    if (func.__overloaded) {
        // first time
        var ofuncname = "_" + fname + $c.suid(5), routeCode = "";
        var condition = "arguments.length == " + func.__args.length;
        var funcSyntax = context + fname + " = function(){";
        for (var i = 0, len = func.__args.length; i < len; i++) {
            var arg = func.__args[i];
            if (arg.type != "any") {
                condition += " && ($c.isNull(arguments[" + i + "]) || arguments[" + i + "].constructor == " + arg.type + ")";
            }
        }
        routeCode += "if(" + condition + ") { var rtn = " + ofuncname + ".apply(this,arguments); " + type_check_code + " }";
        if (body.indexOf(funcSyntax) == -1) {
            body = funcSyntax + routeCode + "};" + body;
        }  else {
            body = body.replace(funcSyntax, funcSyntax + routeCode);
        }
        body = "function " + ofuncname + fvalue.replace('function','') + body;
    } else {
        if (rtype != "any") {
            fvalue = "function(){ " +
                "var rtn = (" + $c.strip(fvalue,';') + ").apply(this, arguments); " +
                type_check_code +
                "};";
        }
        body = context + fname + " = " + fvalue + (func.__code || "") + ';' + body;
    }
    return body;
}
function __strongerType(cls, options) {
    if (!cls || !$c.isFunction(cls)) {
        console.error(options.missing);
        throw options.missing;
    }

    var blocks = __processClass(cls),
        name = cls.name,
        a = eval("(function "+name+" () {throw \""+options.instantiation+"\";})");
    a.___type = options.type;
    a.methods = {public:[],protected:[],private:[],"this":[]};
    a.properties = {public:[],protected:[],private:[],"this":[]};

    for (var i = 0, len = blocks.length; i < len; i++) {
        var parts = blocks[i].match(/^(this|private|protected|public)\.([\s\S]*?)(?:=\s*?([\s\S]*;)|;)/);
        if (parts && parts.length == 4) { // is some kind of class property [0]=>block [1] => access modifier [2] => property [3] => value
            var part = {}, value;
            parts[2] = parts[2].trim();
            part[parts[2]] = parts[3];
            value = $c.tryEval($c.strip(parts[3] || "",';'));
            var mod = parts[1].trim();
            if (parts[2].startsWith('method.')) {// this is a methodvar name = parts[2].replace('method.','');
                var mparts = parts[2].match(/method\.([^\s]*?)\s*(?:\((.*?)\))?$/), afunc;
                var type_and_name = [];
                mparts[1] && (type_and_name = mparts[1].split('.'));

                var method_has_type_defined = type_and_name.length != 1;
                var pname = !method_has_type_defined ? type_and_name[0] : type_and_name[1];

                delete part[parts[2]];
                part.__return_type = method_has_type_defined ? type_and_name[0] : "any";
                part[pname] = parts[3];
                part.__name = pname;
                part.__args = [];


                if (!value && parts[3]) {
                    afunc = $c.strip(parts[3],';');
                    var fargs = $c.getParameters(afunc);
                    var extra = "",parameters = [];
                    for (var k = 0, klen = fargs; k < klen; k++) {
                        var farg = __processParameter(fargs[k]);
                        extra += farg.code;
                        part.__args.push(farg);
                    }
                    if (extra) {
                        value = $c.tryEval(afunc.replace(/function\s*(\*?)\s*\(.*?\)\s*?\{/,"function$1 ("+parameters.join(',')+"){" + extra));
                    }
                } else {
                    if (mparts[2]) {
                        var args = mparts[2].split(',');

                        for (var j = 0, jlen = args.length; j < jlen; j++) {
                            var arg = __processParameter(args[j]);

                            part.__args.push(arg);
                        }
                    }
                }
                part.__value = value;
                a.methods[mod] = a.methods[mod] || [];
                var overloads = $c.where(a.methods[mod],{__name:part.__name}), o = 0, overload;
                while (overload = overloads[o++]) {
                    if (overload.__args.length != part.__args.length) { continue; }
                    var different = false;
                    for (var ai = 0, ailen = overload.__args.length; ai < ailen; ai++) {
                        if (overload.__args[ai].type != part.__args[ai].type) { different = true; break; }
                    }
                    if (!different) {
                        var err = 'Duplicate Error: ' + a.name + "." + part.__name + ' has been already declared with the same signature.';
                        console.error(err);
                        throw err;
                    }
                    overload.__overloaded = part.__overloaded = true;
                }
                a.methods[mod].push(part);
            } else {// this is a property
                var parg = __processParameter(parts[2].trim());
                part.__name = parg.name;
                part.__type = parg.type;
                part.__code = parg.code;
                part.__value = value;
                a.properties[mod] = a.properties[mod] || [];
                a.properties[mod].push(part);
            }
        } else {
            var err = "There can not be code block in abstract classes and interfaces";
            console.error(err);
            throw err;
        }
    }
    return __addprotos(module.exports.context[name] = a);
}

var extendsFrom = function (cls) {
    if (cls.___type === 0) {
        var err = "Class is not extendible";
        console.error(err);
        throw err;
    }
    if (cls.___type !== 1 && this.__type === 1) { // when trying to extend an abstract class with a normal class
        var err = "Abstract classes cannot extend a non-abstract class";
        console.error(err);
        throw err;
    }
    if (!this.name) {
        var err = "Extended Class can not be anonymous.";
        console.error(err);
        throw err;
    }
    var clsToExtend,
        isAbstract = cls.___type === 1;
    if (isAbstract) {
        clsToExtend = cls;
    } else {
        clsToExtend = new cls();
    }
    isAbstract = this.___type === 1;
    var blocks = __processClass(this),
        name = this.name,
        a = this.methods ? this : {methods:{public:[],protected:[],private:[],"this":[]},properties:{public:[],protected:[],private:[],"this":[]}};

    if (!isAbstract) {
        __processBlocks(blocks, a);
    } else {
        a.methods = this.methods;
        a.properties = this.properties;
    }

    var aMethods = cls.methods,
        aProperties = cls.properties,
        aname = cls.name,
        missingItems = {methods:{public:[],protected:[],"this":[]},properties:{public:[],protected:[],"this":[]}},
        existingItems = {methods:{public:[],protected:[],"this":[]}};

    for (var i = 0, obj = aMethods,type = "methods"; i < 2; obj = aProperties,type = "properties", i++) {
        for (var modifier in obj) {
            if (modifier == "private" || !obj.hasOwnProperty(modifier)) {
                continue;
            }
            var types = obj[modifier];

            for (var j = 0, jlen = types.length; j < jlen; j++) {
                var tName = types[j].__name;
                if (!__checkDefined(a[type], types[j])) {
                    if (!isAbstract) {
                        missingItems[type][modifier].push(types[j]);
                    } else if (type == "methods") {
                        this[type][modifier].push(types[j]);
                    }
                } else if (type == "methods" || tName == "construct" || tName == "destruct")  {
                    existingItems["methods"][modifier].push(types[j]);
                }
            }
        }
    }

    if (isAbstract) {
        return __addprotos(this);
    }

    var existingItem = existingItems["methods"],
        parent = "var parent = {";
    for (var modifier in existingItem) {
        if (!existingItem.hasOwnProperty(modifier) || !existingItem[modifier].length) {
            continue;
        }
        var prefix = "var ";
        if (modifier == "public" || modifier == "this") {
            prefix = "this.";
        }

        for (var j = 0, item = existingItem[modifier][j]; item; item = existingItem[modifier][++j]) {
            var pname = item.__name;
            parent += '"' + pname + "\":" + $c.strip((item[pname]||"foo"), ';') +",";
        }
    }

    var additional = "";
    blocks = blocks.join('');
    for (var i = 0, missingItem = missingItems["methods"]; i < 2; obj = aProperties,missingItem = missingItems["properties"], i++) {
        for (var modifier in missingItem) {
            if (!missingItem.hasOwnProperty(modifier)) {
                continue;
            }
            var prefix = "var ";
            if (modifier == "public" || modifier == "this") {
                prefix = "this.";
            }

            for (var j = 0, item = missingItem[modifier][j]; item; item = missingItem[modifier][++j]) {
                if (!i) {
                    blocks = __render_methods(prefix,  item, blocks);
                } else {
                    additional += prefix + item.__name + "=" + $c.parseRaw(item.__value) + ";";
                }
            }

        }
    }
    parent = $c.strip(parent,',') + "};";
    module.exports.context[name] = eval($c.replace_all("(function "+name+"("+__getFuncArgs(this).join(',')+"){"
        + additional
        + parent
        + blocks
        + ($c.contains(blocks, defaultCode) ? "" : "var self=this;" + defaultCode)
        + "})",';;',';'));
    for (var i = 0, prop = "methods"; i < 2; prop = "properties", i++) {
        for (var modifier in missingItems[prop]) {
            a[prop][modifier] = (a[prop][modifier] || []).concat(missingItems[prop][modifier] || []);
        }
    }
    module.exports.context[name].methods = a.methods;
    module.exports.context[name].properties = a.properties;

    return __addprotos(module.exports.context[name]);
};
var implementsInterface = function (cls) {
    if (cls.___type !== 0) {
        var err = "Class is not an Interface";
        console.error(err);
        throw err;
    }
    if (!cls.name || !this.name) {
        var err = "Interface can not be anonymous.";
        console.error(err);
        throw err;
    }
    var blocks = __processClass(this),
        name = this.name,
        isAbstract = this.___type === 1,
        a = this || {methods:{public:[],protected:[],private:[],"this":[]},properties:{public:[],protected:[],private:[],"this":[]}};
    this.methods || __processBlocks(blocks, a, isAbstract && this,true); // this alters blocks and a
    var iMethods = cls.methods,
        iProperties = cls.properties,
        iname = cls.name, errs = [];

    for (var modifier in iMethods) {
        var methods = iMethods[modifier];
        for (var i = 0, len = methods.length; i < len; i++) {
            var methodName = methods[i].__name,
                method = __checkDefined(a.methods, methods[i]);
            if (!method) {
                var sig = "";
                for (var j = 0, jlen = methods[i].__args.length; j < jlen; j++) {
                    var arg = methods[i].__args[j]
                    sig += arg.type + "." +arg.name + ",";
                }
                var err = this.name + " implements interface " + iname + " which must implement " + methodName + "("+$c.strip(sig,',')+")";
                console.error(err);
                errs.push(err);
                continue;
                //throw err;
            }
            var value = eval("("+method[0][methodName].slice(0,-1)+")");
            if (!value || (!$c.isFunction(value) && !$c.isGenerator(value))) {
                var err = this.name + " implements interface " + iname + " and the property " + methodName + " must be a function";
                console.error(err);
                errs.push(err);
                continue;
                //throw err;
            }
        }
    }
    for (var modifier in iProperties) {
        var properties = iProperties[modifier];
        for (var i = 0, len = properties.length; i < len; i++) {
            var propertyName = properties[i].__name;
//            if (a.properties.filter(function(item){return item.__name == propertyName;}).isEmpty()) {
            if (!__checkDefined(a.properties, properties[i])) {
                var err = propertyName + " must be defined";
                console.error(err);
                errs.push(err);
                //throw err;
            }
        }
    }
    if (errs.length) {
        throw errs;
    }
    // if it gets to here the class passes the contract

    if (isAbstract) {
        return __addprotos(this);
    }

    return __addprotos(module.exports.context[name] = eval("(function "+name+"("+__getFuncArgs(this).join(',')+"){"+blocks.join('')+"}"+")"));
};
module.exports.Abstract = function (acls) {
    if (!acls.name) {
        var err = "Abstract Class can not be anonymous.";
        console.error(err);
        throw err;
    }
    return __strongerType(acls, {
        missing : "Abstract: missing required Class parameter",
        instantiation : "Abstract Class can not be instantiated",
        type : 1
    });
};
module.exports.Interface = function (icls) {
    if (!icls.name) {
        var err = "Interface can not be anonymous.";
        console.error(err);
        throw err;
    }
    return __strongerType(icls, {
        missing : "Interface: missing required Class parameter",
        instantiation : "Interfaces can not be instantiated",
        type : 0
    });
};
module.exports.Namespace = function (name,cls){
    if (!cls.name) {
        var err = "Namespace Class can not be anonymous.";
        console.error(err);
        throw err;
    }
    //if (name.indexOf('.') == -1) {
    //    !module.exports.context[name] && (module.exports.context[name] = "");
    //    module.exports.context[name] += cls.toString();
    //} else {
    //    !module.exports.context[name] && (module.exports.context[name] = "");
    //    module.exports.context[name] += cls.toString();
    //    module.exports.context.setProperty(name+"."+cls.name,cls);
    //}
    var current = module.exports.context, path = "__namespaces." + name,
        np = $c.getProperty(current, path);


    //module.exports.context.setProperty("__namespaces." + name + "." + cls.name, cls);
    if (!np) {
        $c.setProperty(current, path, {});
        np = $c.getProperty(current, path);
    }
    if (!cls.methods || !cls.properties) {
        module.exports.context = np;
        module.exports.Public(cls);
    } else {
        current.__namespaces[name][cls.name] = cls;
    }
    module.exports.context = current;

};
module.exports.Public = function (cls) {
    if (!cls.name) {
        var err = "Public Class can not be anonymous.";
        console.error(err);
        throw err;
    }
    var blocks = __processClass(cls),
        name = cls.name,
        a = {methods:{public:[],protected:[],private:[],"this":[]},properties:{public:[],protected:[],private:[],"this":[]}},
        properties = "", methods = "", body = "";
    __processBlocks(blocks, a);

    for (var i = 0, len = modifiers.length; i < len; i++) {
        var modifier = modifiers[i],
            props = a.properties[modifier],
            meths = a.methods[modifier],
            context = modAccessible.indexOf(modifier) == -1 ? "var " : "this.";
        // create properties
        for (var j = 0, jlen = props.length; j < jlen; j++) {
            body += context + props[j].__name + " = " + props[j].__value + (props[j].__code || "") + ";";
        }
        for (var j = 0, jlen = meths.length; j < jlen; j++) {
            body = __render_methods(context,  meths[j], body);
        }
    }

    module.exports.context[name] = eval("(function "+name+"("+__getFuncArgs(cls).join(',')+"){" +
        "var self=this;" + body + defaultCode +
    "})");
    module.exports.context[name].methods = a.methods;
    module.exports.context[name].properties = a.properties;
    return __addprotos(module.exports.context[name]);
};
module.exports.Use = function (np, raw){
    var rtn = $c.getProperty(module.exports.context,"__namespaces." + np);
    if ($c.isFunction(rtn) && rtn.methods && rtn.properties) {
        return raw ? rtn.toString() : rtn;
    }
    if (!raw) {
        return rtn;
    }
    raw = "";
    for (var prop in rtn) {
        if (!rtn.hasOwnProperty(prop)) { continue; }
        raw += rtn[prop].toString();
    }
    return raw;

};
module.exports.extendsFrom = extendsFrom;
module.exports.implementsInterface = implementsInterface;
module.exports.proto = ['extendsFrom','implementsInterface'];
module.exports.context = module.exports;


function getDocumentation (cls, html) {
    var str = "", nl = "\n", tb="    ";
    html && (nl = "<br />");

    str += cls.name + ":" + nl + nl;
    for (var i = 0, pm = ['properties','methods'], prop = pm[i]; i < 2; prop = pm[++i]) {
        for (var j = 0, am = ['private','protected','public','this']; j < 4; j++) {
            am[j] != 'this' && (str += tb + am[j] + " " + prop + ": " + cls[prop][am[j]].length + nl);
            for (var k = 0, klen = cls[prop][am[j]].length, name = ""; k < klen; k++) {
                name = cls[prop][am[j]][k].__name;
                str += tb + tb + name + " ";
                if (prop == "properties") {
                    str += "(default:" + cls[prop][am[j]][k][name] + ")" + nl;
                } else if (prop == "methods") {
                    var params = __getFuncArgs(cls[prop][am[j]][k][name]);
                    str += "(parameters : " + params.length + ")" + nl;
                    for (var l = 0, llen = params.length; l < llen; l++) {
                        str += tb + tb + tb + params[l] + nl;
                    }
                }
            }
        }
    }
}