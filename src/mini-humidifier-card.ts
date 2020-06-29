import { CSSResult, customElement, html, LitElement, property, TemplateResult } from 'lit-element';
import { HomeAssistant } from 'custom-card-helpers';
import { ButtonConfig, DropdownConfig, ElementType, HumidifierCardConfig, TapAction } from './types';
import { Config } from './models/config';
import { StyleInfo, styleMap } from 'lit-html/directives/style-map';
import { HumidifierObject } from './models/humidifier';
import { ClassInfo, classMap } from 'lit-html/directives/class-map';
import style from './style';
import sharedStyle from './sharedStyle';
import { ActionHandlerEvent } from 'custom-card-helpers/dist';
import { handleClick } from './utils/utils';
import { Indicator } from './models/indicator';
import { HassEntity } from 'home-assistant-js-websocket';
import { Button } from './models/button';
import { Dropdown } from './models/dropdown';
import { PowerButton } from './models/power-button';
import { TargetHumidity } from './models/target-humidity';

import './components/dropdown';
import './components/button';
import './components/power-button';
import './components/dropdown-base';
import './components/indicator';
import './components/target-humidity';

import './initialize';
import { getLabel } from './utils/getLabel';

@customElement('mini-humidifier')
export class MiniHumidifierCard extends LitElement {
  private _indicators: { [id: string]: Indicator };
  private _buttons: { [id: string]: Button | Dropdown };
  private _powerButton!: PowerButton;
  private _targetHumidity!: TargetHumidity;

  constructor() {
    super();
    this._indicators = {};
    this._buttons = {};
    this._toggle = false;
  }

  @property()
  public config!: HumidifierCardConfig;

  @property()
  public humidifier!: HumidifierObject;

  @property()
  private _toggle: boolean;

  private _hass: HomeAssistant | undefined;

  public get entity(): HassEntity | undefined {
    return this._hass?.states[this.config.entity];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setConfig(config: any): void {
    this.config = new Config(config);
  }

  public set hass(hass: HomeAssistant) {
    if (!hass) return;
    this._hass = hass;
    let force = false;

    const humidifier = new HumidifierObject(hass, this.config);

    if (humidifier.entity && this.humidifier?.entity !== humidifier.entity) {
      this.humidifier = humidifier;
      force = true;
    }

    this._updateIndicators(force);
    this._updateButtons(force);
    this._updatePowerButton(force);
    this._updateTargetHumidity(force);
  }

  private _updateIndicators(force: boolean): void {
    if (!this._hass || !this.entity) return;

    const indicators: { [id: string]: Indicator } = {};

    let changed = false;

    for (let i = 0; i < this.config.indicators.length; i += 1) {
      const config = this.config.indicators[i];
      const id = config.id;

      const entity = this._hass?.states[config.state.entity];

      if (entity) {
        indicators[id] = new Indicator(this._hass, config, this.entity);
      }

      if (entity !== (this._indicators[id] && this._indicators[id].entity)) changed = true;
    }

    if (changed || force) this._indicators = indicators;
  }

  private _updateButtons(force: boolean): void {
    if (!this._hass || !this.entity) return;

    const buttons: { [id: string]: Button | Dropdown } = {};

    let changed = false;

    for (let i = 0; i < this.config.buttons.length; i += 1) {
      const config = this.config.buttons[i];
      const id = config.id;

      const entity = this._hass?.states[config.state.entity];

      if (entity) {
        if (config.elementType === ElementType.Button) {
          buttons[id] = new Button(this._hass, config as ButtonConfig, entity);
        } else if (config.elementType === ElementType.Dropdown) {
          buttons[id] = new Dropdown(this._hass, config as DropdownConfig, entity);
        }
      }

      if (entity !== (this._buttons[id] && this._buttons[id].entity)) changed = true;
    }

    if (changed || force) this._buttons = buttons;
  }

  private _updatePowerButton(force: boolean): void {
    if (!this._hass || !this.entity) return;

    const config = this.config.power;
    const entity = this._hass?.states[config.state.entity];

    if (force || entity !== this._powerButton?.entity) {
      this._powerButton = new PowerButton(this._hass, config, entity);
    }
  }

  private _updateTargetHumidity(force: boolean): void {
    if (!this._hass || !this.entity) return;

    const config = this.config.targetHumidity;
    const entity = this._hass?.states[config.state.entity];

    if (force || entity !== this._targetHumidity?.entity) {
      this._targetHumidity = new TargetHumidity(this._hass, config, entity);
    }
  }

  protected render(): TemplateResult | void {
    return html`
      <ha-card class=${this._computeClasses()} style=${this._computeStyles()}>
        <div class="mh__bg"></div>
        <div class="mh-humidifier">
          <div class="mh-humidifier__core flex">
            <div class="entity__icon" ?color=${this.humidifier.isActive}>
              <ha-icon .icon=${this.humidifier.icon}> </ha-icon>
            </div>
            <div class="entity__info">
              <div class="wrap">
                <div class="entity__info__name_wrap" @click=${this._onClick}>
                  <div class="entity__info__name">
                    ${this.humidifier.name}
                  </div>
                  ${this._renderSecondaryInfo()}
                </div>
                <div class="ctl-wrap">
                  ${this._renderUnavailable()} ${this._renderTargetHumidifier()} ${this._renderPower()}
                </div>
              </div>
              ${this._renderBottomPanel()}
            </div>
          </div>
          ${this._renderTogglePanel()}
        </div>
      </ha-card>
    `;
  }

  private _renderSecondaryInfo(): TemplateResult | void {
    if (this.humidifier.isUnavailable) return;
    const type = this.config.secondaryInfo.type;

    if (type === 'last-changed') {
      return html`
        <div class="entity__secondary_info ellipsis">
          <ha-relative-time .hass=${this._hass} .datetime=${this.humidifier.entity.last_changed}> </ha-relative-time>
        </div>
      `;
    }

    if (type in this._buttons) {
      const button = this._buttons[type];

      if (button.elementType !== ElementType.Dropdown) return;
      const dropdown = button as Dropdown;
      const selected = dropdown.selected;
      const label = selected ? selected.name : dropdown.state;
      const icon = this.config.secondaryInfo.icon ? this.config.secondaryInfo.icon : dropdown.icon;

      return html`
        <div class="entity__secondary_info ellipsis">
          <ha-icon class="entity__secondary_info_icon" .icon=${icon}> </ha-icon>
          <span class="entity__secondary_info__name">${label}</span>
        </div>
      `;
    }
  }

  private _renderBottomPanel(): TemplateResult | void {
    if (this.humidifier.isUnavailable) return;

    const indicators = Object.entries(this._indicators)
      .map(i => i[1])
      .filter(i => !i.hide)
      .sort((a, b) => (a.order > b.order ? 1 : b.order > a.order ? -1 : 0));

    return html`
      <div class="bottom flex">
        <div class="mh-indicators__container">
          ${indicators.map(
            indicator =>
              html`
                <mh-indicator .indicator="${indicator}"> </mh-indicator>
              `,
          )}
        </div>
        ${this._renderToggleButton()}
      </div>
    `;
  }

  private _renderToggleButton(): TemplateResult | void {
    if (this.config.buttons.length === 0) return;

    if (this.config.toggle.hide) return;

    const cls = this._toggle ? 'open' : '';
    return html`
      <ha-icon-button class="toggle-button ${cls}" .icon=${this.config.toggle.icon} @click=${this._handleToggle}>
      </ha-icon-button>
    `;
  }

  private _renderTogglePanel(): TemplateResult | void {
    if (!this._toggle || this.humidifier.isUnavailable) return;

    const buttons = Object.entries(this._buttons)
      .map(i => i[1])
      .filter(i => !i.hide)
      .sort((a, b) => (a.order > b.order ? 1 : b.order > a.order ? -1 : 0));

    return html`
      <div class="mh-toggle_content">
        ${buttons.map(button => {
          if (button.elementType === ElementType.Button)
            return html`
              <mh-button .button="${button}"> </mh-button>
            `;
          if (button.elementType == ElementType.Dropdown)
            return html`
              <mh-dropdown .dropdown="${button}"> </mh-dropdown>
            `;
          return undefined;
        })}
      </div>
    `;
  }

  private _renderUnavailable(): TemplateResult | void {
    if (!this._hass || !this.humidifier.isUnavailable) return;

    return html`
      <span class="label unavailable ellipsis">
        ${getLabel(this._hass, 'state.default.unavailable', 'Unavailable')}
      </span>
    `;
  }

  private _renderTargetHumidifier(): TemplateResult | void {
    if (this.humidifier.isUnavailable || this._targetHumidity.hide) return;

    return html`
      <mh-target-humidity .targetHumidity=${this._targetHumidity}> </mh-target-humidity>
    `;
  }

  private _renderPower(): TemplateResult | void {
    if (this.humidifier.isUnavailable) return;

    return html`
      <mh-power .button="${this._powerButton}"> </mh-power>
    `;
  }

  private _onClick(ev: ActionHandlerEvent): void {
    ev.preventDefault();
    handleClick(this, this.humidifier.hass, this.humidifier.tapAction);
  }

  private _handleToggle(ev: ActionHandlerEvent): void {
    ev.preventDefault();
    this._toggle = !this._toggle;
  }

  static get styles(): CSSResult[] {
    return [sharedStyle, style];
  }

  private _computeClasses({ config } = this): Function {
    return classMap({
      '--initial': true,
      '--group': config.group,
      '--more-info': config.tapAction.action !== TapAction.None,
      '--inactive': !this.humidifier.isActive,
      '--unavailable': this.humidifier.isUnavailable,
    } as ClassInfo);
  }

  private _computeStyles(): Function {
    const scale = this.config.scale;
    return styleMap({ ...(scale && { '--mh-unit': `${40 * scale}px` }) } as StyleInfo);
  }
}
