'use client'

import { useState } from 'react'
import { estimateBudget, roughCount, type Band } from '@/lib/budget-estimate'
import type { CalculatorCopy } from './copy'
import type { PricingConfig } from '@/lib/billing'
import { parseDemoTopUp } from '@/lib/airtime-demo'
import Segmented from '../landing/Segmented'

const BUDGETS = [100, 250, 500, 1000]
const FORMATS = ['10', '20', '30']
const BAND_KEYS: Band[] = ['any', 'rush', 'day', 'evening', 'night']
const SCREENS = ['1', '3', '5', '10']
const MAX_BUDGET = 100_000

const fill = (text: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((out, [key, value]) => out.split(`{${key}}`).join(String(value)), text)

const hoursText = (h: number) => !Number.isFinite(h) ? '∞' : (h < 10 ? h.toFixed(1) : String(Math.round(h)))

export default function BudgetCalculator({ t, config }: { t: CalculatorCopy; config: PricingConfig }) {
  const p = t.pricing
  const c = p.calc
  const [budgetText, setBudgetText] = useState('100')
  const [format, setFormat] = useState('10')
  const [band, setBand] = useState<Band>('any')
  const [screens, setScreens] = useState('1')

  const parsedBudget = parseDemoTopUp(budgetText)
  const budget = parsedBudget ?? 0
  const e = estimateBudget({ budget, adSeconds: Number(format), band, screens: Number(screens) }, config)
  const n = Number(screens)

  return (
    <div className="lp-calc">
      <div className="lp-calc-head">
        <h3 className="lp-calc-title">{c.title}</h3>
        <p className="lp-calc-lede">{c.lede}</p>
      </div>

      <div className="lp-calc-body">
        <div className="lp-calc-controls">
          <div className="lp-field">
            <label className="lp-field-label" htmlFor="lp-calc-budget">{c.budget}</label>
            <div className="lp-calc-budget">
              <span className="lp-calc-currency" aria-hidden>₾</span>
              <input
                id="lp-calc-budget"
                type="number"
                inputMode="decimal"
                min={0.01}
                max={MAX_BUDGET}
                step={0.01}
                value={budgetText}
                aria-label={c.budgetAria}
                aria-invalid={parsedBudget === null}
                aria-describedby={parsedBudget === null ? 'budget-error' : undefined}
                onChange={(ev) => setBudgetText(ev.target.value)}
              />
            </div>
            {parsedBudget === null && <p id="budget-error" className="demo-error" role="alert">{p.sim.invalidAmount}</p>}
            <div className="lp-meter-topups">
              {BUDGETS.map((b) => (
                <button key={b} type="button" className="lp-chip" aria-pressed={budget === b} onClick={() => setBudgetText(String(b))}>
                  ₾{b.toLocaleString('en-US')}
                </button>
              ))}
            </div>
          </div>
          <Segmented
            label={p.sim.adLength}
            value={format}
            onChange={setFormat}
            options={FORMATS.map((f) => ({ value: f, label: `${f} ${t.loop.seconds}` }))}
          />
          <Segmented
            label={c.when}
            value={band}
            onChange={(v) => setBand(v as Band)}
            options={BAND_KEYS.map((k) => ({ value: k, label: k === 'any' ? c.any : p.bands[k] }))}
          />
          <Segmented
            label={c.screens}
            value={screens}
            onChange={setScreens}
            options={SCREENS.map((s) => ({ value: s, label: s }))}
          />
        </div>

        <div className="lp-calc-result" aria-live="polite" data-invalid={parsedBudget === null || undefined}>
          <p className="lp-calc-plays">
            {roughCount(e.plays.min).toLocaleString('en-US')}
            <span>–</span>
            {roughCount(e.plays.max).toLocaleString('en-US')}
          </p>
          <p className="lp-calc-plays-label">{c.plays}</p>
          <ul className="lp-calc-facts">
            <li>{fill(c.hours, { min: hoursText(e.hours.min), max: hoursText(e.hours.max) })}</li>
            {n > 1 && (
              <li>{fill(c.perScreen, { min: hoursText(e.hoursPerScreen.min), max: hoursText(e.hoursPerScreen.max), n })}</li>
            )}
            <li>{fill(c.perPlay, { min: e.costPerPlay.min.toFixed(3), max: e.costPerPlay.max.toFixed(3) })}</li>
          </ul>
          <p className="lp-calc-note">{c.range}</p>
        </div>
      </div>

      <p className="lp-fineprint lp-calc-assumption">{fill(c.assumption, { seconds: format, plays: e.playsPerHour })}</p>
    </div>
  )
}
