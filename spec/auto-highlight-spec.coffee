_ = require 'underscore-plus'

# Helpers
# -------------------------
getDecorations = (editor) ->
  pattern = /^auto-highlight/

  decorations = []
  for id, decoration of editor.decorationsStateForScreenRowRange(0, editor.getLineCount())
    if decoration.properties.class?.match(pattern)
      decorations.push(decoration)
  decorations

ensureDecorations = (editor, options) ->
  decorations = getDecorations(editor)
  groupedDecoration = _.groupBy decorations, (decoration) ->
    decoration.properties.class.replace(/^auto-highlight /, '')

  toText = ({bufferRange}) -> editor.getTextInBufferRange(bufferRange)
  for color, texts of options
    decoratedTexts = groupedDecoration[color].map(toText)
    expect(decoratedTexts).toEqual(texts)
    delete groupedDecoration[color]

  expect(groupedDecoration).toEqual({})

# Main
# -------------------------
describe "auto-highlight", ->
  [editor, editorContent, editorElement, main] = []

  dispatchCommand = (command, {element}={}) ->
    element ?= editorElement
    atom.commands.dispatch(element, command)

  beforeEach ->
    jasmine.attachToDOM(atom.views.getView(atom.workspace))

    editorContent = """
      orange
        apple
      orange
        apple
      orange
        apple
      """

    waitsForPromise ->
      atom.packages.activatePackage("auto-highlight").then (pack) ->
        main = pack.mainModule

    waitsForPromise ->
      atom.workspace.open('sample-1').then (e) ->
        editor = e
        editor.setText(editorContent)
        editor.setCursorBufferPosition([0, 0])
        editorElement = editor.element

  describe "auto-highlight:toggle", ->
    it "highlight keyword under cursor", ->
      dispatchCommand('auto-highlight:toggle')
      ensureDecorations(editor, "underline-01": ['orange', 'orange', 'orange'])

    it "remove decoration when if already decorated", ->
      dispatchCommand('auto-highlight:toggle')
      ensureDecorations(editor, "underline-01": ['orange', 'orange', 'orange'])
      dispatchCommand('auto-highlight:toggle')
      expect(getDecorations(editor)).toHaveLength(0)

    it "can decorate multiple keyword simultaneously", ->
      dispatchCommand('auto-highlight:toggle')
      ensureDecorations editor,
        "underline-01": ['orange', 'orange', 'orange']
      editor.setCursorBufferPosition([1, 3])
      dispatchCommand('auto-highlight:toggle')
      ensureDecorations editor,
        "underline-01": ['orange', 'orange', 'orange']
        "underline-02": ['apple', 'apple', 'apple']

  describe "auto-highlight:clear", ->
    it "clear all decorations", ->
      dispatchCommand('auto-highlight:toggle')
      editor.setCursorBufferPosition([1, 3])
      dispatchCommand('auto-highlight:toggle')
      expect(getDecorations(editor)).toHaveLength(6)
      dispatchCommand('auto-highlight:clear')
      expect(getDecorations(editor)).toHaveLength(0)

  describe "multiple editors is displayed", ->
    [editor2, editor2Element] = []
    beforeEach ->
      waitsForPromise ->
        atom.workspace.open('sample-2', split: 'right').then (e) ->
          editor2 = e
          editor2.setText(editorContent)
          editor2Element = editor2.element
          editor2.setCursorBufferPosition [0, 0]

      runs ->
        expect(atom.workspace.getActiveTextEditor()).toBe(editor2)

    it "can highlight keyword across editors", ->
      dispatchCommand('auto-highlight:toggle', editor2Element)
      ensureDecorations(editor, "underline-01": ['orange', 'orange', 'orange'])
      ensureDecorations(editor2, "underline-01": ['orange', 'orange', 'orange'])

    it "decorate keywords when new editor was opened", ->
      dispatchCommand('auto-highlight:toggle', editor2Element)
      editor3 = null
      pathSample3 = atom.project.resolvePath("sample-3")

      waitsForPromise ->
        atom.workspace.open(pathSample3, split: 'right').then (e) ->
          editor3 = e

      runs ->
        ensureDecorations(editor, "underline-01": ['orange', 'orange', 'orange'])
        ensureDecorations(editor2, "underline-01": ['orange', 'orange', 'orange'])
        ensureDecorations(editor3, "underline-01": ['orange', 'orange', 'orange'])

  describe "selection changed when highlightSelection", ->
    beforeEach ->
      spyOn(_._, "now").andCallFake -> window.now

    it "decorate selected keyword", ->
      dispatchCommand('editor:select-word')
      advanceClock(150)
      ensureDecorations(editor, "box-selection": ['orange', 'orange', 'orange'])

    it "clear highlight when selection is cleared", ->
      dispatchCommand('editor:select-word')
      advanceClock(150)
      ensureDecorations(editor, "box-selection": ['orange', 'orange', 'orange'])
      editor.clearSelections()
      advanceClock(150)
      expect(getDecorations(editor)).toHaveLength(0)

    it "won't highlight selectedText length is less than highlightSelectionMinimumLength", ->
      atom.config.set("auto-highlight.highlightSelectionMinimumLength", 3)
      dispatchCommand('core:select-right')
      advanceClock(150)
      expect(editor.getSelectedText()).toBe "o"
      expect(getDecorations(editor)).toHaveLength 0
      dispatchCommand('core:select-right')
      advanceClock(150)
      expect(editor.getSelectedText()).toBe "or"
      expect(getDecorations(editor)).toHaveLength 0
      dispatchCommand('core:select-right')
      advanceClock(150)
      expect(editor.getSelectedText()).toBe "ora"
      ensureDecorations(editor, "box-selection": ['ora', 'ora', 'ora'])

    it "won't highlight when selection is all white space", ->
      editor.setCursorBufferPosition([1, 0])
      dispatchCommand('core:select-right')
      advanceClock(150)
      expect(editor.getSelectedText()).toBe "  "
      expect(getDecorations(editor)).toHaveLength 0

    it "won't highlight when selection is multi-line", ->
      dispatchCommand('core:select-down')
      dispatchCommand('core:select-down')
      expect(editor.getSelectedText()).toBe "orange\n  apple\n"
      advanceClock(150)
      expect(getDecorations(editor)).toHaveLength 0

    it "won't highlight when highlightSelection is disabled", ->
      atom.config.set('auto-highlight.highlightSelection', false)
      dispatchCommand('editor:select-word')
      advanceClock(150)
      expect(editor.getSelectedText()).toBe "orange"
      expect(getDecorations(editor)).toHaveLength 0

    describe "highlightSelectionExcludeScopes", ->
      beforeEach ->
        atom.config.set('auto-highlight.highlightSelectionExcludeScopes', [
            'foo.bar',
            'hoge',
          ])

      it "won't highlight when editor have specified scope case-1", ->
        editorElement.classList.add('foo', 'bar')
        dispatchCommand('editor:select-word')
        advanceClock(150)
        expect(editor.getSelectedText()).toBe "orange"
        expect(getDecorations(editor)).toHaveLength 0

      it "won't highlight when editor have specified scope case-2", ->
        editorElement.classList.add('hoge')
        dispatchCommand('editor:select-word')
        advanceClock(150)
        expect(editor.getSelectedText()).toBe "orange"
        expect(getDecorations(editor)).toHaveLength 0

    describe "highlightSelectionDelay", ->
      beforeEach ->
        atom.config.set('auto-highlight.highlightSelectionDelay', 300)

      it "highlight selection after specified delay", ->
        dispatchCommand('editor:select-word')
        expect(editor.getSelectedText()).toBe "orange"
        expect(getDecorations(editor)).toHaveLength 0
        advanceClock(100)
        expect(getDecorations(editor)).toHaveLength 0
        advanceClock(100)
        expect(getDecorations(editor)).toHaveLength 0
        advanceClock(100)
        expect(getDecorations(editor)).toHaveLength 3
        ensureDecorations(editor, "box-selection": ['orange', 'orange', 'orange'])

    describe "displayCountOnStatusBar", ->
      [editor3, container, span] = []
      beforeEach ->
        editor.setText """
          apple orange
          orange lemon orange
          apple
          """

        waitsForPromise -> atom.packages.activatePackage("status-bar")
        waitsFor -> main.keywordManager.statusBarManager.tile?

        runs ->
          container = atom.views.getView(atom.workspace).querySelector('#status-bar-auto-highlight')
          span = container.querySelector('span')

      it 'display latest highlighted count on statusbar', ->
        editor.setCursorBufferPosition([0, 0])
        dispatchCommand('auto-highlight:toggle')
        ensureDecorations(editor, "underline-01": ['apple', 'apple'])
        expect(container.style.display).toBe 'inline-block'
        expect(span.textContent).toBe '2'

        editor.setCursorBufferPosition([1, 0])
        dispatchCommand('auto-highlight:toggle')
        ensureDecorations editor,
          "underline-01": ['apple', 'apple']
          "underline-02": ['orange', 'orange', 'orange']
        expect(container.style.display).toBe 'inline-block'
        expect(span.textContent).toBe '3'

        editor.setCursorBufferPosition([1, 10])
        dispatchCommand('auto-highlight:toggle')
        ensureDecorations editor,
          "underline-01": ['apple', 'apple']
          "underline-02": ['orange', 'orange', 'orange']
          "underline-03": ['lemon']
        expect(container.style.display).toBe 'inline-block'
        expect(span.textContent).toBe '1'
