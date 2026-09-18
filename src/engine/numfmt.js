// 수를 글자로 바꾸는 규칙 — 파이썬·pandas·numpy 가 화면에 찍는 모양을 그대로 흉내 낸다.
// 학생이 보는 출력이 코랩과 한 글자라도 다르면 "내가 틀렸나?" 하고 헷갈리기 때문에
// 규칙을 진짜 라이브러리에서 뽑은 기준 출력(test/golden.json)과 대조해 맞췄다.

// 파이썬 float 의 repr — print(44.96621621621622) 처럼 "가장 짧게 정확한" 표기.
// 자바스크립트 String() 도 가장 짧은 표기를 주지만, 지수로 바뀌는 경계와 정수 모양이 다르다.
export function pyFloat(x) {
  if (Number.isNaN(x)) return 'nan';
  if (x === Infinity) return 'inf';
  if (x === -Infinity) return '-inf';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const [mant, expStr] = x.toExponential().split('e'); // 가장 짧은 유효숫자
  const exp = Number(expStr);
  const neg = mant.startsWith('-');
  const digits = mant.replace('-', '').replace('.', '');
  let body;
  if (exp < -4 || exp >= 16) {
    // 파이썬은 1e-05, 1.5e+16 처럼 지수를 두 자리 이상으로 쓴다
    const m = digits.length > 1 ? digits[0] + '.' + digits.slice(1) : digits;
    const e = Math.abs(exp);
    body = m + 'e' + (exp < 0 ? '-' : '+') + (e < 10 ? '0' + e : String(e));
  } else if (exp >= digits.length - 1) {
    body = digits + '0'.repeat(exp - digits.length + 1) + '.0';
  } else if (exp >= 0) {
    body = digits.slice(0, exp + 1) + '.' + digits.slice(exp + 1);
  } else {
    body = '0.' + '0'.repeat(-exp - 1) + digits;
  }
  return (neg ? '-' : '') + body;
}

// 소수 자릿수를 정해 반올림한 글자 — 파이썬 '%.2f' 와 같게.
// 자바스크립트 toFixed 는 딱 가운데 값(6990.625)을 올리지만(6990.63),
// 파이썬은 짝수 쪽으로 맞춘다(6990.62). 그 경우만 따로 고친다.
export function fixed(x, d) {
  if (!Number.isFinite(x)) return String(x);
  if (Math.abs(x) >= 1e21) return x.toExponential(d);
  const s = x.toFixed(d);
  const full = Math.abs(x).toFixed(Math.min(100, d + 30)); // 이 double 의 정확한 소수 전개
  const dot = full.indexOf('.');
  const tail = full.slice(dot + 1 + d);
  if (!/^50*$/.test(tail)) return s;
  const down = d === 0 ? full.slice(0, dot) : full.slice(0, dot + 1 + d);
  const lastDigit = Number(down[down.length - 1]);
  if (lastDigit % 2 === 1) return s; // 홀수면 올린 쪽(toFixed 결과)이 짝수
  return (x < 0 && Number(down.replace('.', '')) !== 0 ? '-' : '') + down;
}

// pandas 의 실수 열 표기 — 모든 값을 소수 6자리로 적은 뒤,
// "모든 값이 0 으로 끝나면" 한 자리씩 함께 지운다(소수점 아래 한 자리는 남긴다).
// 그래서 47.2 와 44.966216 이 같은 열에 있으면 47.200000 이 된다.
export function pandasFloatColumn(values, precision = 6) {
  const s = values.map((v) => (Number.isNaN(v) ? null : fixed(v, precision)));
  const real = s.filter((x) => x !== null);
  while (real.length && real.every((x) => x.endsWith('0') && !/\.\d$/.test(x))) {
    for (let i = 0; i < s.length; i++) if (s[i] !== null) s[i] = s[i].slice(0, -1);
    for (let i = 0; i < real.length; i++) real[i] = real[i].slice(0, -1);
  }
  return s.map((x) => (x === null ? 'NaN' : x));
}

// 값 하나만 따로 줄이는 표기 (object 열 안에 섞인 실수: 17.0, 44.966216)
export function pandasFloatSingle(v, precision = 6) {
  if (Number.isNaN(v)) return 'NaN';
  let s = fixed(v, precision);
  while (s.endsWith('0') && !/\.\d$/.test(s)) s = s.slice(0, -1);
  return s;
}

// numpy 배열 원소 표기 (precision=8, floatmode='maxprec')
// 원소마다 "가장 짧은 표기, 단 소수 8자리까지"로 적은 뒤 소수점 자리를 맞춰 오른쪽을 빈칸으로 채운다.
//   array([3600.  , 4956.25])   [[0.3959256  0.1875     ...]]
export function numpyFloatElements(values) {
  const parts = values.map((v) => {
    if (Number.isNaN(v)) return ['nan', null];
    let s = pyFloat(v);
    if (/e/.test(s) || s.split('.')[1].length > 8) s = fixed(v, 8);
    let [ip, fp = ''] = s.split('.');
    fp = fp.replace(/0+$/, '');
    return [ip, fp];
  });
  // 자리 맞춤은 nan 이 아닌 값들로 정한다 (모두 nan 이면 'nan' 세 글자)
  const finite = parts.filter(([, fp]) => fp !== null);
  const padL = Math.max(0, ...finite.map(([ip]) => ip.length));
  const padR = Math.max(0, ...finite.map(([, fp]) => fp.length));
  return parts.map(([ip, fp]) => {
    if (fp === null) return ip.padStart(finite.length ? padL + 1 + padR : 3);
    return ip.padStart(padL) + '.' + fp.padEnd(padR);
  });
}

// 파이썬 str.center — 남는 칸이 홀수일 때 어느 쪽에 더 줄지까지 CPython 과 같게.
export function center(s, width) {
  const marg = width - s.length;
  if (marg <= 0) return s;
  const left = Math.floor(marg / 2) + (marg & width & 1);
  return ' '.repeat(left) + s + ' '.repeat(marg - left);
}

// numpy 의 짝수 개 덧셈(pairwise summation).
// 평균을 "앞에서부터 차례로" 더하면 마지막 자리가 코랩과 달라진다. print(mean1) 이
// 44.96621621621622 로 똑같이 나오게 하려면 numpy 가 더하는 순서를 그대로 따라야 한다.
export function pairwiseSum(a, lo = 0, n = a.length - lo) {
  if (n < 8) {
    let res = -0.0;
    for (let i = 0; i < n; i++) res += a[lo + i];
    return res;
  }
  if (n <= 128) {
    const r = [a[lo], a[lo + 1], a[lo + 2], a[lo + 3], a[lo + 4], a[lo + 5], a[lo + 6], a[lo + 7]];
    let i;
    for (i = 8; i < n - (n % 8); i += 8) {
      for (let j = 0; j < 8; j++) r[j] += a[lo + i + j];
    }
    let res = ((r[0] + r[1]) + (r[2] + r[3])) + ((r[4] + r[5]) + (r[6] + r[7]));
    for (; i < n; i++) res += a[lo + i];
    return res;
  }
  let n2 = Math.floor(n / 2);
  n2 -= n2 % 8;
  return pairwiseSum(a, lo, n2) + pairwiseSum(a, lo + n2, n - n2);
}

// numpy 의 선형 보간 백분위수 (np.percentile 기본값 'linear').
// numpy 가 계산하는 식의 순서를 그대로 옮겨 마지막 자리까지 맞춘다.
export function percentileSorted(sorted, q /* 0~100 */) {
  const n = sorted.length;
  if (n === 0) return NaN;
  const qq = q / 100;
  // _compute_virtual_index(n, q, alpha=1, beta=1) = n*q + (1 + q*(1-1-1)) - 1
  let virtual = n * qq + (1 + qq * (1 - 1 - 1)) - 1;
  virtual = Math.min(Math.max(virtual, 0), n - 1);
  const prev = Math.floor(virtual);
  const next = Math.min(prev + 1, n - 1);
  const gamma = virtual - prev;
  const a = sorted[prev], b = sorted[next];
  const diff = b - a;
  if (gamma >= 1) return b - diff * (1 - gamma);
  return a + diff * gamma;
}

// 파일 크기 표기 (info() 의 memory usage 줄)
export function sizeof(num, plus) {
  for (const unit of ['bytes', 'KB', 'MB', 'GB', 'TB']) {
    if (num < 1024) return `${num.toFixed(1)}${plus ? '+' : ''} ${unit}`;
    num /= 1024;
  }
  return `${num.toFixed(1)}${plus ? '+' : ''} PB`;
}
