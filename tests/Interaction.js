import test from './test';
import pointerUtils from '../src/utils/pointerUtils';
import * as helpers from './helpers';

import Interaction from '../src/Interaction';
import InteractEvent from '../src/InteractEvent';
import Signals from '../src/utils/Signals';
import interactions from '../src/interactions';

const makeInteractionAndSignals = () => new Interaction({ signals: new Signals });

test('Interaction constructor', t => {
  const testType = 'test';
  const signals = new Signals();
  const interaction = new Interaction({
    pointerType: testType,
    signals,
  });
  const zeroCoords = {
    page     : { x: 0, y: 0 },
    client   : { x: 0, y: 0 },
    timeStamp: 0,
  };
  const zeroDelta = {
    page     : { x: 0, y: 0, vx: 0, vy: 0, speed: 0 },
    client   : { x: 0, y: 0, vx: 0, vy: 0, speed: 0 },
    timeStamp: 0,
  };

  t.equal(interaction._signals, signals,
    'signals option is set assigned to interaction._signals');

  t.ok(interaction.prepared instanceof Object,
    'interaction.prepared is an object');
  t.ok(interaction.downPointer instanceof Object,
    'interaction.downPointer is an object');

  t.deepEqual(interaction.prevCoords, zeroCoords,
    'interaction.prevCoords set to zero');
  t.deepEqual(interaction.curCoords, zeroCoords,
    'interaction.curCoords set to zero');
  t.deepEqual(interaction.startCoords, zeroCoords,
    'interaction.startCoords set to zero');
  t.deepEqual(interaction.pointerDelta, zeroDelta,
    'interaction.pointerDelta set to zero');

  t.equal(interaction.pointerType, testType,
    'interaction.pointerType is set');

  // pointerInfo properties
  t.deepEqual(
    interaction.pointers,
    [],
    'interaction.pointers is initially an empty array');

  // false properties
  for (const prop of 'pointerIsDown pointerWasMoved _interacting mouse'.split(' ')) {
    t.notOk(interaction[prop], `interaction.${prop} is false`);
  }

  t.end();
});

test('Interaction.getPointerIndex', t => {
  const interaction = makeInteractionAndSignals();

  interaction.pointers = [2, 4, 5, 0, -1].map(id => ({ id }));

  interaction.pointers.forEach(({ id }, index) => {
    t.equal(interaction.getPointerIndex({ pointerId: id }), index);
  });

  t.end();
});

test('Interaction.updatePointer', t => {
  t.test('no existing pointers', st => {
    const interaction = makeInteractionAndSignals();
    const pointer = { pointerId: 10 };
    const event = {};

    const ret = interaction.updatePointer(pointer, event);

    st.deepEqual(interaction.pointers, [{
      id: pointer.pointerId,
      pointer,
      event,
      downTime: null,
      downTarget: null,
    }],
      'interaction.pointers == [{ pointer, ... }]');
    st.equal(ret, 0, 'new pointer index is returned');

    st.end();
  });

  t.test('new pointer with exisiting pointer', st => {
    const interaction = makeInteractionAndSignals();
    const existing = { pointerId: 0 };
    const event = {};

    interaction.updatePointer(existing, event);

    const newPointer = { pointerId: 10 };
    const ret = interaction.updatePointer(newPointer, event);

    st.deepEqual(
      interaction.pointers, [
        {
          id: existing.pointerId,
          pointer: existing,
          event,
          downTime: null,
          downTarget: null,
        },
        {
          id: newPointer.pointerId,
          pointer: newPointer,
          event,
          downTime: null,
          downTarget: null,
        },
      ],
      'interaction.pointers == [{ pointer: existing, ... }, { pointer: newPointer, ... }]');

    st.equal(ret, 1, 'second pointer index is 1');

    st.end();
  });

  t.test('update existing pointers', st => {
    const interaction = makeInteractionAndSignals();

    const oldPointers = [-3, 10, 2].map(pointerId => ({ pointerId }));
    const newPointers = oldPointers.map(pointer => ({ ...pointer, new: true }));

    oldPointers.forEach(pointer => interaction.updatePointer(pointer));
    newPointers.forEach(pointer => interaction.updatePointer(pointer));

    st.equal(interaction.pointers.length, oldPointers.length,
      'number of pointers is unchanged');

    interaction.pointers.forEach((pointerInfo, i) => {
      st.equal(pointerInfo.id, oldPointers[i].pointerId,
        `pointer[${i}].id is the same`);
      st.notEqual(pointerInfo.pointer, oldPointers[i],
        `new pointer ${i} !== old pointer object`);
    });

    st.end();
  });
});

test('Interaction.removePointer', t => {
  const interaction = makeInteractionAndSignals();
  const ids = [0, 1, 2, 3];
  const removals = [
    { id: 0, remain: [1, 2, 3], message: 'first of 4' },
    { id: 2, remain: [1,    3], message: 'middle of 3' },
    { id: 3, remain: [1      ], message: 'last of 2' },
    { id: 1, remain: [       ], message: 'final' },
  ];

  ids.forEach((pointerId) => interaction.updatePointer({ pointerId }));

  for (const removal of removals) {
    interaction.removePointer({ pointerId: removal.id });

    t.deepEqual(
      interaction.pointers.map(p => p.id),
      removal.remain,
      `${removal.message} - remaining interaction.pointers is correct`);
  }

  t.end();
});

test('Interaction.pointerDown', t => {
  const interaction = makeInteractionAndSignals();
  const coords = helpers.newCoordsSet();
  const eventTarget = {};
  const event = {
    type: 'down',
    target: eventTarget,
  };
  const pointer = helpers.newPointer();
  let signalArg;

  const signalListener = arg => {
    signalArg = arg;
  };

  interaction._signals.on('down', signalListener);

  const pointerCoords = { page: {}, client: {} };
  pointerUtils.setCoords(pointerCoords, [pointer]);

  for (const prop in coords) {
    pointerUtils.copyCoords(interaction[prop + 'Coords'], coords[prop]);
  }

  // test while interacting
  interaction._interacting = true;
  interaction.pointerDown(pointer, event, eventTarget);

  t.equal(interaction.downEvent, null, 'downEvent is not updated');
  t.deepEqual(
    interaction.pointers,
    [{
      id: pointer.pointerId,
      pointer,
      event,
      downTime: null,
      downTarget: null,
    }],
    'pointer is added'
  );

  t.deepEqual(interaction.downPointer, {}, 'downPointer is not updated');

  t.deepEqual(interaction.startCoords, coords.start, 'startCoords are not modified');
  t.deepEqual(interaction.curCoords,   coords.cur,   'curCoords   are not modified');
  t.deepEqual(interaction.prevCoords,  coords.prev,  'prevCoords  are not modified');

  t.ok(interaction.pointerIsDown, 'pointerIsDown');
  t.notOk(interaction.pointerWasMoved, '!pointerWasMoved');

  t.equal(signalArg.pointer,      pointer,     'pointer      in down signal arg');
  t.equal(signalArg.event,        event,       'event        in down signal arg');
  t.equal(signalArg.eventTarget,  eventTarget, 'eventTarget  in down signal arg');
  t.equal(signalArg.pointerIndex, 0,           'pointerIndex in down signal arg');

  // test while not interacting
  interaction._interacting = false;
  // reset pointerIsDown
  interaction.pointerIsDown = false;
  // pretend pointer was moved
  interaction.pointerWasMoved = true;
  // reset signalArg object
  signalArg = undefined;

  interaction.removePointer(pointer);
  interaction.pointerDown(pointer, event, eventTarget);

  // timeStamp is assigned with new Date.getTime()
  // don't let it cause deepEaual to fail
  pointerCoords.timeStamp = interaction.startCoords.timeStamp;

  t.equal(interaction.downEvent, event, 'downEvent is updated');

  t.deepEqual(
  interaction.pointers,
    [{
      id: pointer.pointerId,
      pointer,
      event,
      downTime: pointerCoords.timeStamp,
      downTarget: eventTarget,
    }],
    'interaction.pointers is updated');

  t.deepEqual(interaction.startCoords, pointerCoords, 'startCoords are set to pointer');
  t.deepEqual(interaction.curCoords,   pointerCoords, 'curCoords   are set to pointer');
  t.deepEqual(interaction.prevCoords,  pointerCoords, 'prevCoords  are set to pointer');

  t.equal(typeof signalArg, 'object', 'down signal was fired again');
  t.ok(interaction.pointerIsDown, 'pointerIsDown');
  t.notOk(interaction.pointerWasMoved, 'pointerWasMoved should always change to false');

  t.end();
});

test('Interaction.start', t => {
  const interaction = makeInteractionAndSignals();
  const action = { name: 'TEST' };
  const target = helpers.mockInteractable();
  const element = {};
  const pointer = helpers.newPointer();
  const event = {};

  interaction.start(action, target, element);
  t.equal(interaction.prepared.name, null, 'do nothing if !pointerIsDown');

  // pointers is still empty
  interaction.pointerIsDown = true;
  interaction.start(action, target, element);
  t.equal(interaction.prepared.name, null, 'do nothing if too few pointers are down');

  interaction.pointerDown(pointer, event, null);

  interaction._interacting = true;
  interaction.start(action, target, element);
  t.equal(interaction.prepared.name, null, 'do nothing if already interacting');

  interaction._interacting = false;

  let signalArg;
  // let interactingInStartListener;
  const signalListener = arg => {
    signalArg = arg;
    // interactingInStartListener = arg.interaction.interacting();
  };

  interaction._signals.on('action-start', signalListener);
  interaction.start(action, target, element);

  t.equal(interaction.prepared.name, action.name, 'action is prepared');
  t.equal(interaction.target, target, 'interaction.target is updated');
  t.equal(interaction.element, element, 'interaction.element is updated');

  // t.assert(interactingInStartListener, 'interaction is interacting during action-start signal');
  t.assert(interaction.interacting(), 'interaction is interacting after start method');
  t.equal(signalArg.interaction, interaction, 'interaction in signal arg');
  t.equal(signalArg.event, event, 'event (interaction.downEvent) in signal arg');

  interaction._interacting = false;

  // interaction.start(action, target, element);
  // t.deepEqual(scope.interactions, [interaction], 'interaction is added back to scope');

  t.end();
});

test('stop interaction from start event', t => {
  const scope = helpers.mockScope();

  interactions.init(scope);
  const interaction = scope.Interaction.new({});
  const interactable = helpers.mockInteractable();

  interaction.target = interactable;
  interaction.element = interactable.element;
  interaction.prepared = { name: 'TEST' };

  interactable.events.on('TESTstart', event => {
    event.interaction.stop();
  });

  interaction._signals.fire('action-start', { interaction, event: {} });

  t.notOk(interaction.interacting(), 'interaction can be stopped from start event listener');

  t.end();
});

test('Interaction createPreparedEvent', t => {
  const scope = helpers.mockScope();

  interactions.init(scope);

  const interaction = scope.Interaction.new({});
  const interactable = helpers.mockInteractable();
  const action = { name: 'resize' };
  const phase = 'TEST_PHASE';

  interaction.prepared = action;
  interaction.target = interactable;
  interaction.element = interactable.element;
  interaction.prevEvent = { page: {}, client: {}, velocity: {} };

  const iEvent = interaction._createPreparedEvent({}, phase);

  t.ok(iEvent instanceof InteractEvent,
    'InteractEvent is fired');

  t.equal(iEvent.type, action.name + phase,
    'event type');

  t.equal(iEvent.interactable, interactable,
    'event.interactable');

  t.equal(iEvent.target, interactable.element,
    'event.target');

  t.end();
});

test('Interaction fireEvent', t => {
  const interaction = new Interaction({ signals: helpers.mockSignals() });
  const interactable = helpers.mockInteractable();
  const iEvent = {};
  let firedEvent;

  // this method should be called from actions.firePrepared
  interactable.fire = event => {
    firedEvent = event;
  };

  interaction.target = interactable;
  interaction._fireEvent(iEvent);

  t.equal(firedEvent, iEvent,
    'target interactable\'s fire method is called');

  t.equal(interaction.prevEvent, iEvent,
    'interaction.prevEvent is updated');

  t.end();
});
