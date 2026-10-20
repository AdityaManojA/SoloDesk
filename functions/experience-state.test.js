import test from 'node:test';
import assert from 'node:assert/strict';
import {installNoticeKey,onboardingKey,wasSeen,rememberSeen} from '../src/experience-state.js';

test('onboarding completion is isolated by account and demo; install suggestion is device-wide',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  rememberSeen(storage,onboardingKey('account-a'));
  assert.equal(wasSeen(storage,onboardingKey('account-a')),true);
  assert.equal(wasSeen(storage,onboardingKey('account-b')),false);
  assert.equal(wasSeen(storage,onboardingKey('demo')),false);
  rememberSeen(storage,installNoticeKey);
  assert.equal(wasSeen(storage,installNoticeKey),true);
  assert.equal(wasSeen(storage,onboardingKey('account-b')),false);
});
test('blocked or full preference storage does not prevent closing onboarding',()=>{
  const storage={getItem(){throw new Error('Blocked');},setItem(){throw new Error('Quota');}};
  assert.equal(wasSeen(storage,onboardingKey('a')),false);
  assert.equal(rememberSeen(storage,onboardingKey('a')),false);
});
