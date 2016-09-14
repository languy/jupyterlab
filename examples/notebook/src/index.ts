// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  NotebookPanel, NotebookWidgetFactory,
  NotebookModelFactory, NotebookActions
} from 'jupyterlab/lib/notebook';

import {
  CodeMirrorNotebookPanelRenderer
} from 'jupyterlab/lib/notebook/codemirror/notebook/panel';

import {
  IServiceManager, createServiceManager, IAjaxSettings
} from 'jupyter-js-services';

import {
  DocumentManager
} from 'jupyterlab/lib/docmanager';

import {
  DocumentRegistry, restartKernel, selectKernelForContext
} from 'jupyterlab/lib/docregistry';

import {
  RenderMime
} from 'jupyterlab/lib/rendermime';

import {
  HTMLRenderer, LatexRenderer, ImageRenderer, TextRenderer,
  JavascriptRenderer, SVGRenderer, MarkdownRenderer
} from 'jupyterlab/lib/renderers';

import {
  defaultSanitizer
} from 'jupyterlab/lib/sanitizer';

import {
  MimeData
} from 'phosphor/lib/core/mimedata';

import {
  CommandRegistry
} from 'phosphor/lib/ui/commandregistry';

import {
  CommandPalette
} from 'phosphor/lib/ui/commandpalette';

import {
  Keymap
} from 'phosphor/lib/ui/keymap';

import {
  SplitPanel
} from 'phosphor/lib/ui/splitpanel';

import {
  Widget
} from 'phosphor/lib/ui/widget';

import 'jupyterlab/lib/default-theme/index.css';
import '../index.css';

function main(): void {
  let jl = new JupyterLab('jupyter-notebook-wrapper', 'test.ipynb', null, 'http://localhost:8889');
  jl.embedJupyterLabUI();
}

export class JupyterLab {
  public NOTEBOOK = 'test.ipynb';
  public div_id = 'jupyter-notebook-wrapper';
  public serviceManagerOptions:IServiceManager.IOptions = {};
    
  constructor(div_id: string, notebook_name: string, ajaxSettings?: IAjaxSettings, baseUrl?: string) {
    this.div_id = div_id;
    this.NOTEBOOK = notebook_name;
    this.serviceManagerOptions.ajaxSettings = ajaxSettings; 
    this.serviceManagerOptions.baseUrl = baseUrl;
  }

  /**
   * The map of command ids used by the notebook.
   */
  private cmdIds = {
    save: 'notebook:save',
    interrupt: 'notebook:interrupt-kernel',
    restart: 'notebook:restart-kernel',
    switchKernel: 'notebook:switch-kernel',
    runAndAdvance: 'notebook-cells:run-and-advance',
    deleteCell: 'notebook-cells:delete',
    selectAbove: 'notebook-cells:select-above',
    selectBelow: 'notebook-cells:select-below',
    extendAbove: 'notebook-cells:extend-above',
    extendBelow: 'notebook-cells:extend-below',
    editMode: 'notebook:edit-mode',
    merge: 'notebook-cells:merge',
    split: 'notebook-cells:split',
    commandMode: 'notebook:command-mode',
    undo: 'notebook-cells:undo',
    redo: 'notebook-cells:redo'
  };

  public embedJupyterLabUI(): void {
    createServiceManager(this.serviceManagerOptions).then(manager => {
      this.createApp(manager);
    });
  }

  private createApp(manager: IServiceManager): void {
    // Initialize the keymap manager with the bindings.
    let commands = new CommandRegistry();
    let keymap = new Keymap({ commands });
    let useCapture = true;

    // Setup the keydown listener for the document.
    document.addEventListener('keydown', event => {
      keymap.processKeydownEvent(event);
    }, useCapture);

    const transformers = [
      new JavascriptRenderer(),
      new MarkdownRenderer(),
      new HTMLRenderer(),
      new ImageRenderer(),
      new SVGRenderer(),
      new LatexRenderer(),
      new TextRenderer()
    ];
    let renderers: RenderMime.MimeMap<RenderMime.IRenderer> = {};
    let order: string[] = [];
    for (let t of transformers) {
      for (let m of t.mimetypes) {
        renderers[m] = t;
        order.push(m);
      }
    }
    let sanitizer = defaultSanitizer;
    let rendermime = new RenderMime({ renderers, order, sanitizer });

    let opener = {
      open: (widget: Widget) => {
        // Do nothing for sibling widgets for now.
      }
    };

    let docRegistry = new DocumentRegistry();
    let docManager = new DocumentManager({
      registry: docRegistry,
      manager,
      opener
    });
    let mFactory = new NotebookModelFactory();
    let clipboard = new MimeData();
    let renderer = CodeMirrorNotebookPanelRenderer.defaultRenderer;
    let wFactory = new NotebookWidgetFactory(rendermime, clipboard, renderer);
    docRegistry.addModelFactory(mFactory);
    docRegistry.addWidgetFactory(wFactory, {
      displayName: 'Notebook',
      modelName: 'notebook',
      fileExtensions: ['.ipynb'],
      defaultFor: ['.ipynb'],
      preferKernel: true,
      canStartKernel: true
    });

    let nbWidget = docManager.open(this.NOTEBOOK) as NotebookPanel;
    let palette = new CommandPalette({ commands, keymap });

    let panel = new SplitPanel();
    panel.id = 'main';
    panel.orientation = 'horizontal';
    panel.spacing = 0;
    SplitPanel.setStretch(palette, 0);
    panel.addWidget(palette);
    panel.addWidget(nbWidget);
    Widget.attach(panel, document.getElementById(this.div_id));

    SplitPanel.setStretch(nbWidget, 1);
    window.onresize = () => panel.update();

    commands.addCommand(this.cmdIds.save, {
      label: 'Save',
      execute: () => nbWidget.context.save()
    });
    commands.addCommand(this.cmdIds.interrupt, {
      label: 'Interrupt',
      execute: () => {
        if (nbWidget.context.kernel) {
          nbWidget.context.kernel.interrupt();
        }
      }
    });
    commands.addCommand(this.cmdIds.restart, {
      label: 'Restart Kernel',
      execute: () => restartKernel(nbWidget.kernel, nbWidget.node)
    });
    commands.addCommand(this.cmdIds.switchKernel, {
      label: 'Switch Kernel',
      execute: () => selectKernelForContext(nbWidget.context, nbWidget.node)
    });
    commands.addCommand(this.cmdIds.runAndAdvance, {
      label: 'Run and Advance',
      execute: () => {
        NotebookActions.runAndAdvance(nbWidget.content, nbWidget.context.kernel);
      }
    });
    commands.addCommand(this.cmdIds.editMode, {
      label: 'Edit Mode',
      execute: () => { nbWidget.content.mode = 'edit'; }
    });
    commands.addCommand(this.cmdIds.commandMode, {
      label: 'Command Mode',
      execute: () => { nbWidget.content.mode = 'command'; }
    });
    commands.addCommand(this.cmdIds.selectBelow, {
      label: 'Select Below',
      execute: () => NotebookActions.selectBelow(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.selectAbove, {
      label: 'Select Above',
      execute: () => NotebookActions.selectAbove(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.extendAbove, {
      label: 'Extend Above',
      execute: () => NotebookActions.extendSelectionAbove(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.extendBelow, {
      label: 'Extend Below',
      execute: () => NotebookActions.extendSelectionBelow(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.merge, {
      label: 'Merge Cells',
      execute: () => NotebookActions.mergeCells(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.split, {
      label: 'Split Cell',
      execute: () => NotebookActions.splitCell(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.undo, {
      label: 'Undo',
      execute: () => NotebookActions.undo(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.redo, {
      label: 'Redo',
      execute: () => NotebookActions.redo(nbWidget.content)
    });

    let category = 'Notebook Operations';
    [
      this.cmdIds.interrupt,
      this.cmdIds.restart,
      this.cmdIds.editMode,
      this.cmdIds.commandMode,
      this.cmdIds.switchKernel
    ].forEach(command => palette.addItem({ command, category }));

    category = 'Notebook Cell Operations';
    [
      this.cmdIds.runAndAdvance,
      this.cmdIds.split,
      this.cmdIds.merge,
      this.cmdIds.selectAbove,
      this.cmdIds.selectBelow,
      this.cmdIds.extendAbove,
      this.cmdIds.extendBelow,
      this.cmdIds.undo,
      this.cmdIds.redo
    ].forEach(command => palette.addItem({ command, category }));

    let bindings = [
    {
      selector: '.jp-Notebook',
      keys: ['Shift Enter'],
      command: this.cmdIds.runAndAdvance
    },
    {
      selector: '.jp-Notebook',
      keys: ['Accel S'],
      command: this.cmdIds.save
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['I', 'I'],
      command: this.cmdIds.interrupt
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['0', '0'],
      command: this.cmdIds.restart
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Enter'],
      command: this.cmdIds.editMode
    },
    {
      selector: '.jp-Notebook.jp-mod-editMode',
      keys: ['Escape'],
      command: this.cmdIds.commandMode
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Shift M'],
      command: this.cmdIds.merge
    },
    {
      selector: '.jp-Notebook.jp-mod-editMode',
      keys: ['Ctrl Shift -'],
      command: this.cmdIds.split
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['J'],
      command: this.cmdIds.selectBelow
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['ArrowDown'],
      command: this.cmdIds.selectBelow
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['K'],
      command: this.cmdIds.selectAbove
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['ArrowUp'],
      command: this.cmdIds.selectAbove
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Shift K'],
      command: this.cmdIds.extendAbove
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Shift J'],
      command: this.cmdIds.extendBelow
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Z'],
      command: this.cmdIds.undo
    },
      {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Y'],
      command: this.cmdIds.redo
    }
    ];
    bindings.map(binding => keymap.addBinding(binding));
  }
}

window.onload = main;
