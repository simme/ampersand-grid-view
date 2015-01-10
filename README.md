# ampersand-grid-view

A collection backed grid view.

_This is not quite a 1.0 release, but it's pretty close. It works for the
simple cases._

## What it does

The grid view takes a container and an [ampersand-collection](https://www.npmjs.com/package/ampersand-collection)
and renders it into a grid with a set number of columns. Items will be rendered
into the currently shortest column. Hence this module can be used to create a
Pinterest-like grid of items.

## Usage

```javascript
var AmpGridView = require('ampersand-grid-view');
var data = new AmpersandCollection(); // Create a collection containing your models

var MyView = require('./my-model-view');

var gridView = new AmpGridView({
  view: MyView,
  collection: data,
  el: document.querySelector('.some-container'),
  columnCount: 3,
  gutter: 10,
  viewOptions: {
    // additional properties passed to new views.
  }
});
```

This will create a grid of three columns with 10px spacing between each view.
Each model in the collection `data` will be represented by the view `MyView`.

If more models are added to the collection they will automatically render into
the view.

## Async Views

Views can be asynchronous, meaning, you can tell the grid that you do not want
to be inserted right after rendering. But rather at some point later. You do
this by adding a property `async` to your view and set it to `true`. Then
have the view emit a `ready` event when it is ready to be drawn into the grid.

This is useful when you are rendering images of unknown sizes for example. Since
the grid has to know the height of the view being rendered it can't just insert
it into the grid and have the image load later, this will cause overlapping.

```javascript
module.exports = AmpersandView.extend({
  async: true,
  done: false,
  template: function () {
    return someTemplateThatHasAnImage;
  },

  render: function initPostView() {
    this.renderWithTemplate(this);
    var self = this;
    // Star loading image
    var image = new Image();
    image.src = this.model.image;

    // Upon success set our imageUrl property to the URL and have
    // bindings update the src attribute.
    // Then set `async` to false to prevent consecutive renders if the grid
    // reflows for example
    image.onload = function imageLoaded() {
      self.imageUrl = image.src;
      self.trigger('ready');
      self.async = false;
    };
    image.onerror = function imageError() {
      // You could remove the image here and render the view anyway. Or replace
      // it with some standard image.
      self.trigger('ready');
      self.async = false;
    };
  },
});
```

Note that currently there is not way to ensure ordering of views in async mode
unless you keep track outside of the grid view yourself. This will be fixed in
the future though.

## Responsive Web Design

If you need to change the number of colums based on the window size for example
you can do this by hooking up an event listener on the `resize` event of the
`window` object. Then set the property `columnCount` on the grid view and call
the `reflow()` method.

The grid view won't handle anything like this automatically.

A view will always be the container's width divided by column count. So you can
adjust the views widths by setting the width of the container yourself and
adjusting the `gutter` property.

## Endless Scrolling

If you want endless scrolling you can just listen to the scroll event yourself
and then when the user reaches the bottom you load more models and add them
to the collection. They will automatically render in the grid.

You could use my [toBottom](https://www.npmjs.com/package/tobottom) module for
this.

## Different Views

If you have different kinds of models in you collection and need to render
different kinds of views you can set the `view` option to an object where the
keys match `model.type || model.getType()` and the value is a matching view
constructor.

## Performance Concerns

All the views will be absolutely positioned within it's container. This is to
make the layout job for the browser easier. DOM operations are also somewhat
grouped together to decrease the repaints etc necessary.

## License

MIT
