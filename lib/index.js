'use strict';

var path = require('path');
var wild2regex = require('../lib/wildcardToRegex.js');

function analyze_options(option) {
  var i;
  var srcset, sizes, keys, reg;
  var temp = {};
  var ret = [];

  srcset = Object.keys(option.srcset);
  for (i = 0; i < srcset.length; i++) {
    reg = wild2regex(srcset[i]);
    temp[srcset[i]] = {};
    temp[srcset[i]].regex = reg;
    temp[srcset[i]].rules = option.srcset[srcset[i]];
  }

  sizes = Object.keys(option.sizes);
  for (i = 0; i < sizes.length; i++) {
    // check if the same key is contained in 'srcset'
    if (temp[sizes[i]]) {
      temp[sizes[i]].sizes = option.sizes[sizes[i]];
    }
  }

  keys = Object.keys(temp);
  for (i = 0; i < keys.length; i++) {
    ret.push(temp[keys[i]]);
  }

  return ret;
}

// Return first pattern to match.
// If not, return -1
function matchPattern(src, patterns) {
  var i;
  for (i = 0; i < patterns.length; i++) {
    if (patterns[i].regex.exec(src)) {
      return i;
    }
  }
  return -1;
}

module.exports = function responsive_plugin(md, rr_options) {
  if (!rr_options || !rr_options.responsive) {
    throw new Error('markdown-it-responsive needs options');
  }

  var defaultRender = md.renderer.rules.image;

  md.renderer.rules.image = function (tokens, idx, options, env, slf) {
    var token = tokens[idx];

    var patterns = analyze_options(rr_options.responsive);
    // normal fields
    var filename = token.attrs[token.attrIndex('src')][1];
    token.attrs.splice(token.attrIndex('src'), 1);
    if (token.attrIndex('alt') === -1) {
      token.attrPush(['alt', slf.renderInlineAsText(token.children, options, env)]);
    } else if (!token.attrs[token.attrIndex('alt')][1]) {
      token.attrs[token.attrIndex('alt')][1] = slf.renderInlineAsText(token.children, options, env);
    }

    // responsive fields
    var i, patternId;
    var base, ext, dir, rules, isFirst;

    if ((patternId = matchPattern(filename, patterns)) >= 0) {
      rules = patterns[patternId].rules;
      ext = path.extname(filename);
      base = path.basename(filename, ext);
      dir = path.dirname(filename);
      isFirst = true;
      var srcset = '';
      var tmpfile, tmpdir;

      var output = '<picture>';
      var sources = '';

      for (i = 0; i < rules.length; i++) {
        if (!isFirst) {
          srcset += ', ';
        }
        tmpfile = '';
        if (rules[i].rename && rules[i].rename.prefix) {
          tmpfile += rules[i].rename.prefix + base;
        }
        tmpfile += base;
        if (rules[i].rename && rules[i].rename.suffix) {
          tmpfile += rules[i].rename.suffix;
        }
        tmpdir = dir;
        if (rules[i].rename && rules[i].rename.path) {
          if (typeof rules[i].rename.path === 'function') {
            tmpdir = rules[i].rename.path(tmpdir);
          } else if (typeof rules[i].rename.path === 'string') {
            tmpdir = rules[i].rename.path;
          }
        }
        if (tmpdir === '.') {
          tmpdir = '';
        } else {
          tmpdir += '/';
        }
        // console.log(tmpdir + tmpfile + ext + ' ' + i);
        var source = '<source '

        if (rules[i - 1]) {
          if (rules[i - 1].width) {
            source += 'media="(min-width: ' + rules[i - 1].width + 'px)" '
          }
          if (rules[i - 1].height) {
            source += 'media="(min-height: ' + rules[i - 1].height + 'px)" '
          }
        }
        source += 'srcset="' + tmpdir + tmpfile + '_1x.webp 1x' + ', ' + tmpdir + tmpfile + '_2x' + ext + ' 2x' + '" type="image/webp">'

        srcset += tmpdir + tmpfile + ext + ' ';
        if (rules[i].width) {
          srcset += rules[i].width + 'w';
        }
        if (rules[i].height) {
          srcset += rules[i].height + 'h';
        }
        sources = source + sources
        isFirst = false;
      }

      output += sources

      if (srcset) {
        token.attrPush(['srcset', srcset]);

        if (patterns[patternId].sizes) {
          token.attrPush(['sizes', patterns[patternId].sizes]);
        }

        if (!rr_options.responsive.removeSrc) {
          token.attrPush(['src', filename]);
        }
        output += slf.renderToken(tokens, idx, options)
      }

      output += '</picture>'
      return output
    }

    // pass token to default renderer.
    return defaultRender(tokens, idx, options, env, slf)
  }
}