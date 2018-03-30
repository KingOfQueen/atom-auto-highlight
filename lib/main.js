const {CompositeDisposable, Emitter} = require('atom')
const path = require('path')

const javascriptKeywords = {"abstract":1, "arguments":1, "await":1, "boolean":1, "break":1, "byte":1, "case":1, "catch":1, "char":1, "class":1, "const":1, "continue":1, "debugger":1, "default":1, "delete":1, "do":1, "double":1, "else":1, "enum":1, "eval":1, "export":1, "extends":1, "false":1, "final":1, "finally":1, "float":1, "for":1, "function":1, "goto":1, "if":1, "implements":1, "import":1, "in":1, "instanceof":1, "int":1, "interface":1, "let":1, "long":1, "native":1, "new":1, "null":1, "package":1, "private":1, "protected":1, "public":1, "return":1, "short":1, "static":1, "super":1, "switch":1, "synchronized":1, "this":1, "throw":1, "throws":1, "transient":1, "true":1, "try":1, "typeof":1, "var":1, "void":1, "volatile":1, "while":1, "with":1, "yield":1}

const javaKeywords = {"abstract":1, "assert":1, "boolean":1, "break":1, "byte":1, "case":1, "catch":1, "char":1, "class":1, "const":1, "continue":1, "default":1, "do":1, "double":1, "else":1, "enum":1, "extends":1, "final":1, "finally":1, "float":1, "for":1, "goto":1, "if":1, "implements":1, "import":1, "instanceof":1, "int":1, "interface":1, "long":1, "native":1, "new":1, "package":1, "private":1, "protected":1, "public":1, "return":1, "short":1, "static":1, "strictfp":1, "super":1, "switch":1, "synchronized":1, "this":1, "throw":1, "throws":1, "transient":1, "try":1, "void":1, "volatile":1, "while":1, "true":1, "false":1, "null":1}

const pythonKeywords = {"and":1, "del":1, "from":1, "not":1, "while":1, "as":1, "elif":1, "global":1, "or":1, "with":1, "assert":1, "else":1, "if":1, "pass":1, "yield":1, "break":1, "except":1, "import":1, "print":1, "class":1, "exec":1, "in":1, "raise":1, "continue":1, "finally":1, "is":1, "return":1, "def":1, "for":1, "lambda":1, "try":1}

let KeywordManager

let ToggledWordCount = 0

function getWordAtPosition (str, pos) {

    var left = str.substr(0, pos);
    var right = str.substr(pos);

    left = left.replace(/^.+[; .?*+^$[\]\\(){}|-]/g, "");

    //remove from space to the last character:
    right = right.replace(/[; .?*+^$[\]\\(){}|-].+?$/g, "");

    //remove the last special character if exist in the end of line:
    right = right.replace(/[; .?*+^$[\]\\(){}|-].?$/g, "");

    return left + right;
}

function maybeVariableName(str) {
    return /^[a-z_A-Z]+$/.test(str);
}

function getReservedWordForExt(ext){
    if(ext == ".java"){
        return javaKeywords;
    }
    else if(ext == ".py"){
        return pythonKeywords;
    }
    return javascriptKeywords;
}

function getConfig (name) {
  return atom.config.get(`auto-highlight.${name}`)
}

module.exports = {
  activate (state) {
    this.emitter = new Emitter()
    this.toggle = this.toggle.bind(this)
    const toggle = this.toggle

    this.toggleEditorByCursorEvent = this.toggleEditorByCursorEvent.bind(this)
    const toggleEditorByCursorEvent = this.toggleEditorByCursorEvent

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-text-editor:not([mini])', {
        'auto-highlight:toggle' () {
          toggle(getCursorWord(this.getModel()))
        },
        'auto-highlight:clear': () => this.keywordManager && this.keywordManager.clear()
    }));

    this.subscriptions.add(atom.config.observe('auto-highlight.highlightSelection', value => {
        if (value) this.getKeywordManager() // To initialize
    }));


    this.subscriptions.add(atom.workspace.observeTextEditors(editor => {
      console.log("editor observed");
      editor.onDidChangeCursorPosition(event => {
          try {
              toggleEditorByCursorEvent(editor, event)
          }
          catch(error) {
            console.error(error);
            // expected output: SyntaxError: unterminated string literal
            // Note - error messages will vary depending on browser
          }

      });
    }));
  },

  deactivate () {
    if (this.keywordManager) this.keywordManager.destroy()
    this.subscriptions.dispose()
    this.keywordManager = null
    this.subscriptions = null
  },

  getKeywordManager () {
    if (!KeywordManager) KeywordManager = require('./keyword-manager')
    if (!this.keywordManager) {
      this.keywordManager = new KeywordManager(this.emitter)
      this.setStatusBarService()
    }
    return this.keywordManager
  },

  toggle (keyword) {
    this.getKeywordManager().toggle(keyword)
  },

  toggleEditorByCursorEvent (editor, event){
      var cursorWordChanged = false;
      oldColumn = event.oldBufferPosition.column
      newColumn = event.newBufferPosition.column
      line = editor.lineTextForBufferRow(event.newBufferPosition.row)

      if ((event.oldBufferPosition.row != event.newBufferPosition.row) || event.textChanged.valueOf() ){
          cursorWordChanged = true;
      }
      //text not changed:
      else if (getWordAtPosition(line,oldColumn) !=  getWordAtPosition(line,newColumn)) {
          cursorWordChanged = true
          //console.log(getWordAtPosition(line,oldColumn) + " -> " +  getWordAtPosition(line,newColumn))
      }
      word = getWordAtPosition(line, newColumn)
      //highlightWord = getCursorWord(editor)

      ext = path.extname(editor.getPath())

      //ignore reserved keywords for current language based on file extension
      if(ext.startsWith('.') && word in getReservedWordForExt(ext)){
          return;
      }

      if(!cursorWordChanged){
          console.log("not changed" + word)
          return;
      }

      if(maybeVariableName(word) && word.length >= getConfig('highlightSelectionMinimumLength') ){
          //clear toggles if more than NUM of words toggled, NUM default to 2:
          if(ToggledWordCount >= getConfig('highlightSelectionMaxNumberOfWord') ){
              this.keywordManager && this.keywordManager.clear();
              ToggledWordCount = 0
          }

          //TODO: to highlight whole word except prefix matched ones
          //toggle(word)
          this.getKeywordManager().toggle(word)
          ToggledWordCount += 1
      }

  },

  onDidChangeHighlight (fn) {
    return this.emitter.on('did-change-highlight', fn)
  },

  provideQuickHighlight () {
    return {onDidChangeHighlight: this.onDidChangeHighlight.bind(this)}
  },

  setStatusBarService () {
    if (this.statusBarService && this.keywordManager) {
      this.keywordManager.setStatusBarService(this.statusBarService)
    }
  },

  consumeStatusBar (service) {
    this.statusBarService = service
    this.setStatusBarService()
  },

  consumeVim ({getClass, registerCommandsFromSpec}) {
    this.subscriptions.add(
      registerCommandsFromSpec(['AutoHighlight', 'AutoHighlightWord'], {
        prefix: 'vim-mode-plus-user',
        loader: () => require('./load-vmp-commands')(getClass, this.toggle)
      })
    )
  }
}

function getCursorWord (editor) {
  const selection = editor.getLastSelection()
  const selectedText = selection.getText()
  if (selectedText) {
    return selectedText
  } else {
    const cursorPosition = selection.cursor.getBufferPosition()
    selection.selectWord()
    const word = selection.getText()
    selection.cursor.setBufferPosition(cursorPosition)
    return word
  }
}
