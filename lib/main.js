const {CompositeDisposable, Emitter} = require('atom')

let KeywordManager

let ToggleWordCount = 0

function getWordAt (str, pos) {

    var left = str.substr(0, pos);
    var right = str.substr(pos);

    left = left.replace(/^.+[ ,;\.\(\)]/g, "");
    right = right.replace(/[ ,;\.\(\)].+$/g, "");

    return left + right;
}

function maybeVariableName(str) {
    return /^[a-z_A-Z]+$/.test(str);
}

module.exports = {
  activate (state) {
    this.emitter = new Emitter()
    this.toggle = this.toggle.bind(this)
    const toggle = this.toggle

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // this.subscriptions.add(atom.commands.add('atom-workspace', {
    //   'auto-selection:toggle': () => this.toggle()
    // }));
     
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
      console.log("editor // DEBUG: ");
      editor.onDidChangeCursorPosition(event => {
          editorView = atom.views.getView(editor);

          try {
              var cursorWordChanged = false;
              oldColumn = event.oldBufferPosition.column
              newColumn = event.newBufferPosition.column
              line = editor.lineTextForBufferRow(event.newBufferPosition.row)

              if ((event.oldBufferPosition.row != event.newBufferPosition.row) || event.textChanged.valueOf() ){
                  cursorWordChanged = true;
              }
              else{ //text not changed:
                  //console.log(oldColumn + "->" + newColumn)
                  if (getWordAt(line,oldColumn) !=  getWordAt(line,newColumn)) {
                      cursorWordChanged = true
                      //console.log(getWordAt(line,oldColumn) + " -> " +  getWordAt(line,newColumn))
                  }
              }

              if(cursorWordChanged){
                  word = getWordAt(line, newColumn)
                  //word = getCursorWord(editor); // dead loop here?
                  if(maybeVariableName(word)){
                      //console.log("highlight: " + word)
                      if(ToggleWordCount>=2){
                          //clear toggles if more than 3 words toggled:
                          this.keywordManager && this.keywordManager.clear();
                          ToggleWordCount = 0
                      }
                      toggle(getCursorWord(editor))
                      ToggleWordCount += 1
                      //https://github.com/t9md/atom-quick-highlight/blob/master/lib/main.js
                  }
              }

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
