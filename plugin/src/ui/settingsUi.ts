import { Setting } from 'obsidian';
import { callBound, construct } from '../utils/call';

export class ButtonControl {
  constructor(private readonly btn: unknown) {}

  setButtonText(text: string): this {
    callBound(this.btn, 'setButtonText', text);
    return this;
  }

  setCta(): this {
    callBound(this.btn, 'setCta');
    return this;
  }

  setDisabled(disabled: boolean): this {
    callBound(this.btn, 'setDisabled', disabled);
    return this;
  }

  onClick(handler: () => void | Promise<void>): this {
    callBound(this.btn, 'onClick', () => {
      void handler();
    });
    return this;
  }
}

export class DropdownControl {
  constructor(private readonly dropdown: unknown) {}

  addOption(value: string, label: string): this {
    callBound(this.dropdown, 'addOption', value, label);
    return this;
  }

  setValue(value: string): this {
    callBound(this.dropdown, 'setValue', value);
    return this;
  }

  onChange(handler: (value: string) => void | Promise<void>): this {
    callBound(this.dropdown, 'onChange', (value: string) => {
      void handler(value);
    });
    return this;
  }
}

export class TextControl {
  constructor(private readonly text: unknown) {}

  get inputEl(): HTMLInputElement {
    const el: unknown = Reflect.get(this.text as object, 'inputEl');
    return el as HTMLInputElement;
  }

  setValue(value: string): this {
    callBound(this.text, 'setValue', value);
    return this;
  }

  setPlaceholder(value: string): this {
    callBound(this.text, 'setPlaceholder', value);
    return this;
  }

  onChange(handler: (value: string) => void | Promise<void>): this {
    callBound(this.text, 'onChange', (value: string) => {
      void handler(value);
    });
    return this;
  }
}

export class SettingControl {
  constructor(private readonly setting: Setting) {}

  setName(name: string): this {
    callBound(this.setting, 'setName', name);
    return this;
  }

  setDesc(desc: string): this {
    callBound(this.setting, 'setDesc', desc);
    return this;
  }

  setHeading(): this {
    callBound(this.setting, 'setHeading');
    return this;
  }

  addButton(configure: (btn: ButtonControl) => void): this {
    callBound(this.setting, 'addButton', (raw: unknown) => {
      configure(new ButtonControl(raw));
    });
    return this;
  }

  addDropdown(configure: (dropdown: DropdownControl) => void): this {
    callBound(this.setting, 'addDropdown', (raw: unknown) => {
      configure(new DropdownControl(raw));
    });
    return this;
  }

  addText(configure: (text: TextControl) => void): this {
    callBound(this.setting, 'addText', (raw: unknown) => {
      configure(new TextControl(raw));
    });
    return this;
  }
}

export function addSetting(container: HTMLElement): SettingControl {
  return new SettingControl(construct(Setting, container));
}
