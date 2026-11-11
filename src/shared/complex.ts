export interface Complex {
  re: number;
  im: number;
}

export const c = (re: number, im = 0): Complex => ({ re, im });
export const add = (a: Complex, b: Complex): Complex => c(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex): Complex => c(a.re - b.re, a.im - b.im);
export const mul = (a: Complex, b: Complex): Complex =>
  c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const conj = (a: Complex): Complex => c(a.re, -a.im);
export const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im;
export const abs = (a: Complex): number => Math.hypot(a.re, a.im);
export const arg = (a: Complex): number => Math.atan2(a.im, a.re);
export const scale = (a: Complex, k: number): Complex => c(a.re * k, a.im * k);

export function div(a: Complex, b: Complex): Complex {
  const d = abs2(b);
  if (d === 0) throw new Error("Division by zero");
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}

export function sqrt(a: Complex): Complex {
  const r = abs(a);
  const re = Math.sqrt((r + a.re) / 2);
  const im = (a.im < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (r - a.re) / 2));
  return c(re, im);
}

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z]+)|(√)|([+\-*/^(),]))/y;
  let pos = 0;
  const s = src.replace(/−/g, "-").trim();
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) throw new Error(`Unexpected character '${s[pos]}'`);
    pos = re.lastIndex;
    if (m[1] !== undefined) tokens.push({ t: "num", v: parseFloat(m[1]) });
    else if (m[2] !== undefined) tokens.push({ t: "id", v: m[2].toLowerCase() });
    else if (m[3] !== undefined) tokens.push({ t: "id", v: "sqrt" });
    else tokens.push({ t: "op", v: m[4] });
  }
  return tokens;
}

/**
 * Parses complex expressions such as "1", "0.5-0.5i", "i/√2", "(1+i)/sqrt(2)",
 * "2i", "exp(i*pi/4)". Supports + - * / ^ (non-negative integer powers, or real
 * powers of real bases), implicit multiplication, i/j, pi, sqrt, exp.
 */
export function parseComplex(src: string): Complex {
  const tokens = tokenize(src);
  if (tokens.length === 0) throw new Error("Empty input");
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v: string) => {
    const k = peek();
    return k !== undefined && k.t === "op" && k.v === v;
  };

  const startsPrimary = (): boolean => {
    const k = peek();
    if (!k) return false;
    return k.t === "num" || k.t === "id" || (k.t === "op" && k.v === "(");
  };

  function expr(): Complex {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[p++] as { v: string }).v;
      const r = term();
      v = op === "+" ? add(v, r) : sub(v, r);
    }
    return v;
  }

  function term(): Complex {
    let v = unary();
    for (;;) {
      if (isOp("*")) {
        p++;
        v = mul(v, unary());
      } else if (isOp("/")) {
        p++;
        v = div(v, unary());
      } else if (startsPrimary()) {
        v = mul(v, power());
      } else return v;
    }
  }

  function unary(): Complex {
    if (isOp("-")) {
      p++;
      return scale(unary(), -1);
    }
    if (isOp("+")) {
      p++;
      return unary();
    }
    return power();
  }

  function power(): Complex {
    const base = primary();
    if (!isOp("^")) return base;
    p++;
    const e = unary();
    if (e.im === 0 && Number.isInteger(e.re) && e.re >= 0 && e.re <= 64) {
      let r = c(1);
      for (let n = 0; n < e.re; n++) r = mul(r, base);
      return r;
    }
    if (e.im === 0 && base.im === 0 && base.re >= 0) return c(Math.pow(base.re, e.re));
    throw new Error("Unsupported exponent");
  }

  function primary(): Complex {
    const k = tokens[p++];
    if (!k) throw new Error("Unexpected end of input");
    if (k.t === "num") return c(k.v);
    if (k.t === "op" && k.v === "(") {
      const v = expr();
      if (!isOp(")")) throw new Error("Missing ')'");
      p++;
      return v;
    }
    if (k.t === "id") {
      if (k.v === "i" || k.v === "j") return c(0, 1);
      if (k.v === "pi") return c(Math.PI);
      if (k.v === "sqrt" || k.v === "exp") {
        const a = isOp("(") ? primary() : power();
        if (k.v === "sqrt") return sqrt(a);
        const m = Math.exp(a.re);
        return c(m * Math.cos(a.im), m * Math.sin(a.im));
      }
      throw new Error(`Unknown name '${k.v}'`);
    }
    throw new Error(`Unexpected '${k.v}'`);
  }

  const result = expr();
  if (p < tokens.length) throw new Error(`Unexpected '${(tokens[p] as { v: string | number }).v}'`);
  if (!Number.isFinite(result.re) || !Number.isFinite(result.im)) throw new Error("Not a finite number");
  return result;
}

export function formatNumber(x: number, digits = 4): string {
  if (Math.abs(x) < 1e-12) return "0";
  return String(parseFloat(x.toFixed(digits)));
}

export function formatComplex(z: Complex, digits = 4): string {
  const re = formatNumber(z.re, digits);
  const im = formatNumber(Math.abs(z.im), digits);
  if (im === "0") return re;
  const sign = z.im < 0 ? "−" : "+";
  const imPart = im === "1" ? "i" : `${im}i`;
  if (re === "0") return z.im < 0 ? `−${imPart}` : imPart;
  return `${re} ${sign} ${imPart}`;
}
