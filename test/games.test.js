import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../server/games.js';

const game = (kind) => {
  const g = G.create(kind, 'a');
  G.join(g, 'b');
  return g;
};

test('tic-tac-toe: wins, draws and rematch order', () => {
  let g = game('ttt');
  for (const [p, c] of [['a', 0], ['b', 1], ['a', 4], ['b', 2], ['a', 8]]) G.move(g, p, c);
  assert.equal(g.state.winner, 0);
  assert.deepEqual(g.state.line, [0, 4, 8]);
  g = game('ttt');
  for (const [p, c] of [['a', 0], ['b', 1], ['a', 2], ['b', 4], ['a', 3], ['b', 5], ['a', 7], ['b', 6], ['a', 8]]) G.move(g, p, c);
  assert.equal(g.state.winner, 'draw');
  G.rematch(g, 'a');
  assert.equal(g.status, 'done', 'waits for both players');
  G.rematch(g, 'b');
  assert.equal(g.state.turn, 1, 'the other player starts the rematch');
});

test('rock-paper-scissors hides picks until both chose; first to two wins', () => {
  const g = game('rps');
  G.move(g, 'a', 'rock');
  assert.deepEqual(G.view(g).state.picked, [true, false]);
  assert.equal('picks' in G.view(g).state, false);
  G.move(g, 'b', 'scissors');
  G.move(g, 'a', 'paper');
  G.move(g, 'b', 'paper');
  assert.deepEqual(g.state.score, [1, 0]);
  G.move(g, 'a', 'scissors');
  G.move(g, 'b', 'paper');
  assert.equal(g.state.winner, 0);
});

test('connect four and forfeits', () => {
  let g = game('c4');
  for (let i = 0; i < 3; i++) {
    G.move(g, 'a', 0);
    G.move(g, 'b', 1);
  }
  G.move(g, 'a', 0);
  assert.equal(g.state.winner, 0);
  g = game('c4');
  G.move(g, 'a', 2);
  assert.equal(G.leave(g, 'b'), false);
  assert.equal(g.state.winner, 0);
  assert.equal(g.state.forfeit, true);
  assert.equal(G.leave(g, 'a'), true, 'deleted when everyone has left');
});

test('darts scoring matches a real board', () => {
  const s = (x, y) => G.dartScore(x, y).s;
  assert.equal(s(0, 0), 50);
  assert.equal(s(0.06, 0), 25);
  assert.equal(s(0, -0.8), 20);
  assert.equal(s(0, -0.6), 60);
  assert.equal(s(0, -0.98), 40);
  assert.equal(s(0.8, 0), 6);
  assert.equal(s(0, 0.8), 3);
  assert.equal(s(-0.8, 0), 11);
  assert.equal(s(1.1, 0), 0);
});

test('darts: three darts per turn, three rounds, highest total wins', () => {
  const g = game('darts');
  assert.throws(() => G.move(g, 'b', { x: 0, y: 0 }), /Not your turn/);
  assert.throws(() => G.move(g, 'a', { x: 'zz', y: 0 }));
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 3; i++) G.move(g, 'a', { x: 0, y: -0.8 });
    for (let i = 0; i < 3; i++) G.move(g, 'b', { x: 0.8, y: 0 });
  }
  assert.equal(g.status, 'done');
  assert.deepEqual(g.state.scores, [180, 54]);
  assert.equal(g.state.winner, 0);
});
