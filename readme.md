# impervious

A simple and opionated proxy for state management.

## What

## Why

## How

## Atomic

Within a call to `update` any changes you make to the proxy are not applied.  We simply record the mutations and apply them in order.

The reasoning behind this is that it is extraordinarily difficult to make a JS proxy truly imitate a JS object.  Instead of treading carefully into the uncanny valley we instead acknowledge the proxy can never truly fake the real thing, instead it is a nice affordance to make complex immutable update feel mutable.

An **impervious** proxy has very predictable and limited behaviour.  By way of example, here is a list of things impervious doesn't even try to imitate. 

- If you `delete` a property from an object, it isn't gone until after the patch is complete
- If you `push` an item into a list, it won't be there until after the patch is complete
- If you call `shift` you will mutate the list after the patch, but shift will always return the same item within the update.
- If you assign a property, well you get the idea

Think of the object you are interacting with as a completely immutable frozen object.  Any change you make will not be visible within that transaction.  But all changes / operations are recorded and are applied naively after the patch is complete.
