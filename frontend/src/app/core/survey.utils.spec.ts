import { SurveyQuestion } from './pokestop.model';
import { compactAnswers, ratingScale, validateAnswers } from './survey.utils';

const q = (key: string, type: SurveyQuestion['type'], extra: Partial<SurveyQuestion> = {}): SurveyQuestion => ({
  id: 1, key, label: key, type, required: true, options: [], min: null, max: null, ...extra,
});
const OPTIONS = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

describe('validateAnswers (te same reguły co backend/apps/pokestops/survey.py)', () => {
  it('requires required questions and skips optional ones', () => {
    const questions = [q('must', 'text'), q('may', 'text', { required: false })];
    expect(validateAnswers(questions, {})).toEqual({ must: 'To pole jest wymagane' });
    expect(validateAnswers(questions, { must: 'x' })).toEqual({});
  });

  it('checks numbers against min and max', () => {
    const number = q('n', 'number', { min: 0, max: 10 });
    expect(validateAnswers([number], { n: 11 })['n']).toContain('Maksimum');
    expect(validateAnswers([number], { n: -1 })['n']).toContain('Minimum');
    expect(validateAnswers([number], { n: 5 })).toEqual({});
    expect(validateAnswers([number], { n: true as never })['n']).toBe('Podaj liczbę');
  });

  it('checks ratings (default 1 to 5, own range when given)', () => {
    expect(validateAnswers([q('r', 'rating')], { r: 6 })['r']).toBe('Ocena od 1 do 5');
    expect(validateAnswers([q('r', 'rating')], { r: 3 })).toEqual({});
    expect(validateAnswers([q('r', 'rating', { min: 1, max: 3 })], { r: 4 })['r']).toBe('Ocena od 1 do 3');
    expect(ratingScale(q('r', 'rating'))).toEqual([1, 2, 3, 4, 5]);
  });

  it('checks options, multiselect and booleans', () => {
    expect(validateAnswers([q('c', 'choice', { options: OPTIONS })], { c: 'z' })['c']).toBeTruthy();
    expect(validateAnswers([q('c', 'choice', { options: OPTIONS })], { c: 'a' })).toEqual({});
    expect(validateAnswers([q('m', 'multiselect', { options: OPTIONS })], { m: ['a', 'z'] })['m']).toBeTruthy();
    expect(validateAnswers([q('m', 'multiselect', { options: OPTIONS })], { m: [] })['m']).toBe('To pole jest wymagane');
    expect(validateAnswers([q('b', 'boolean')], { b: false })).toEqual({});
    expect(validateAnswers([q('b', 'boolean')], { b: 'tak' })['b']).toBeTruthy();
  });

  it('drops empty answers before sending', () => {
    expect(compactAnswers({ a: '', b: [], c: false, d: 0, e: 'x' })).toEqual({ c: false, d: 0, e: 'x' });
  });
});
