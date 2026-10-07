const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'babel-plugin-codegen',
  'index.js',
);

function replaceOnce(source, oldValue, newValue) {
  if (!source.includes(oldValue)) {
    throw new Error(`Expected to find patch target:\n${oldValue}`);
  }

  return source.replace(oldValue, newValue);
}

if (!fs.existsSync(targetPath)) {
  throw new Error(`Missing target file: ${targetPath}`);
}

let source = fs.readFileSync(targetPath, 'utf8');

if (source.includes('this.skipCodegen =')) {
  process.exit(0);
}

source = replaceOnce(
  source,
  `      this.codeInserted = false;\n    },`,
  `      this.codeInserted = false;\n      this.skipCodegen =\n        this.filename.includes('/src/private/specs_DEPRECATED/') ||\n        this.filename.includes('\\\\src\\\\private\\\\specs_DEPRECATED\\\\') ||\n        this.filename.includes('/src/private/components/virtualview/') ||\n        this.filename.includes('\\\\src\\\\private\\\\components\\\\virtualview\\\\');\n    },`,
);

source = replaceOnce(
  source,
  `      ExportNamedDeclaration(path) {\n        if (this.codeInserted) {\n          return;\n        }`,
  `      ExportNamedDeclaration(path) {\n        if (this.skipCodegen) {\n          return;\n        }\n\n        if (this.codeInserted) {\n          return;\n        }`,
);

source = replaceOnce(
  source,
  `      ExportDefaultDeclaration(path, state) {\n        if (isCodegenDeclaration(path.node.declaration)) {`,
  `      ExportDefaultDeclaration(path, state) {\n        if (this.skipCodegen) {\n          return;\n        }\n\n        if (isCodegenDeclaration(path.node.declaration)) {`,
);

source = replaceOnce(
  source,
  `      Program: {\n        exit(path) {\n          if (this.defaultExport) {`,
  `      Program: {\n        exit(path) {\n          if (this.skipCodegen) {\n            return;\n          }\n\n          if (this.defaultExport) {`,
);

fs.writeFileSync(targetPath, source);
console.log('Patched React Native codegen plugin for Expo export compatibility.');
