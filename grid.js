//
// # Grid View
//
// Renders a collection into a grid of columns.
//
/* jshint browser: true */
/* jshint node: true */
'use strict';

var AmpersandExtend = require('ampersand-class-extend');
var BBEvents = require('backbone-events-standalone');
// @TODO: Replace underscore with matching amp modules.
var _ = require('underscore');

var defaultOptions = {
  // View constructor or object mapping model.type to a view constructor.
  'view': null,
  // The collection to render.
  'collection': null,
  // The container of the grid.
  'el': null,
  // Whether or not to maintain order in async mode.
  'ensureOrder': false,
  // Number of columns. Defaults to 5.
  'columnCount': 5,
  // How much space to insert between each view. Defaults to 20.
  'gutter': 20,
  // How long to wait for async cells before giving up.
  'asyncTimeout': 2000,
  // Object of additional view options to pass new views.
  'viewOptions': {},
};

function GridView(spec) {
  if (!spec) {
    throw new Error('Grid view is missing required parameters.');
  }

  if (!spec.collection) {
    throw new Error('Grid view requires a collection.');
  }

  if (!spec.el) {
    throw new Error('Grid view requires an el.');
  }

  if (!spec.view) {
    throw new Error('Grid view requires a view constructor.');
  }

  // Put options upon this.
  _.extend(this, defaultOptions, _.pick(spec, Object.keys(defaultOptions)));

  // Hook up event listeners
  this.listenTo(this.collection, 'add', this.addViewForModel);
  this.listenTo(this.collection, 'remove', this.removeViewForModel);
  this.listenTo(this.collection, 'sort', this.reflow);
  this.listenTo(this.collection, 'refresh reset', this.reset);

  // Keep track of all created views.
  this.views = [];

  // Keep track of each column and it's length.
  this.columns = [];
  // Calculated view width.
  this.viewWidth = 0;

  // Insert queue for items not yet in the DOM. Useful for grouping DOM
  // operations.
  this.layoutQueue = [];
  this.layoutTimer = null;
  this.layoutInterval = 20;
}

_.extend(GridView.prototype, BBEvents, {

  // --------------------------------------------------------------------------
  // Ampersand view interface
  // --------------------------------------------------------------------------

  //
  // ## Render
  //
  // Renders the collection.
  //
  // **Returns** `this`.
  //
  render: function () {
    this.reflow();
    return this;
  },

  //
  // ## Remove
  //
  // The view is being removed from it's super view. Clean up!
  //
  // **Returns** nothing.
  //
  remove: function () {
    _.invoke(this.views, 'remove');
    this.stopListening();
  },

  // --------------------------------------------------------------------------
  // Layout engine
  // --------------------------------------------------------------------------

  //
  // ## Reflow
  //
  reflow: function () {
    this.setup();
    this.collection.forEach(this.addViewForModel.bind(this));
  },

  //
  // ## Setup
  //
  // Reset the columns array and calculate our view width based on the
  // container's width.
  //
  // **Returns** nothing.
  //
  setup: function () {
    this.columns.length = 0;
    this.columns = [];
    for (var i = 0; i < this.columnCount; i++) {
      this.columns.push(0);
    }

    var containerWidth = this.el.clientWidth;
    var gutters = (this.columnCount - 1) * this.gutter;
    var availableWidth = containerWidth - gutters;
    this.viewWidth = availableWidth / this.columnCount;
  },

  //
  // ## Shortest Column
  //
  // **Returns** the index of the shortest column.
  //
  shortestColumn: function () {
    return this.columns.indexOf(Math.min.apply(Math, this.columns));
  },

  //
  // ## Longest Column
  //
  // **Returns** the index of the longest column.
  //
  longestColumn: function () {
    return this.columns.indexOf(Math.max.apply(Math, this.columns));
  },

  //
  // ## Height
  //
  // **Returns** the height of the highest column.
  //
  height: function () {
    return this.columns[this.longestColumn()];
  },

  //
  // ## Add View For Model
  //
  // Get the view for a model and queue it for layout.
  //
  // **Returns** nothing.
  //
  addViewForModel: function (model) {
    var view = this.getOrCreateViewForModel(model);
    if (!view.rendered) {
      view.render();
      view.renderedByParent = true;
    }

    if (view.async && !view.done) {
      view.on('ready', queueView.bind(this, view));
    }
    else {
      queueView.call(this, view);
    }

    /* jshint validthis: true */
    function queueView(view) {
      if (!this.layoutTimer) {
        setTimeout(this.layout.bind(this), this.layoutInterval);
      }

      // @TODO: If we need to render ordered content we should wait with
      // putting the view on to the layout queue until the previous view has
      // declared itself ready. We could add a property to each view that is
      // a reference to it's previous view (linked list). If that view reference
      // has not been rendered we should hold off. Or something.
      this.layoutQueue.push(view);
    }
  },

  //
  // ## Layout
  //
  // Empty the layout queue by taking all the views in it and laying them out
  // in our grid.
  //
  layout: function () {
    // Empty queue and layout items.
    this.layoutQueue.splice(0)
      .forEach(render, this);

    /* jshint validthis: true */
    function render(view) {
      var el = view.el;
      this.el.appendChild(el);
      el.style.width = this.viewWidth + 'px';

      setTimeout(function () {
        var targetColumn = this.shortestColumn();
        var x = (targetColumn * this.viewWidth) + (this.gutter * targetColumn);
        var y = this.columns[targetColumn];

        el.style.position = 'absolute';
        el.style.left = x + 'px';
        el.style.top = y + 'px';

        var viewHeight = el.offsetHeight + this.gutter;
        this.columns[targetColumn] += viewHeight;
      }.bind(this));
    }
  },

  // --------------------------------------------------------------------------
  // Utility functions
  // --------------------------------------------------------------------------

  //
  // ## View For Model
  //
  // Returns a rendered view for the given model.
  //
  // * **model**, the model to find a view for.
  //
  // **Returns** a view or `undefined`.
  //
  viewForModel: function (model) {
    return _.find(this.views, function (view) {
      return model === view.model;
    });
  },

  //
  // ## Create View For Model
  //
  // Creates a new view for the given model. If the `view` option was set to
  // an object the grid view will inspect the `model.type` or call
  // `model.getType()` and map the result against the `view` option. It expects
  // to find a view constructor.
  //
  // * **model**, the model to create a view for.
  //
  // **Returns** a new view.
  // **Throws** an error if a view constructor could not be found.
  //
  createViewForModel: function (model) {
    var constructor = null;
    if (typeof this.view === 'function') {
      constructor = this.view;
    }
    else {
      var type = model.type || model.getType();
      constructor = this.view[type];
    }

    if (!constructor) {
      throw new Error('Missing valid view constructor for model.');
    }

    var viewOptions = _.extend({
      model: model,
      collection: this.collection,
      parent: this.parent,
    }, this.viewOptions);
    var view = new this.view(viewOptions);
    this.views.push(view);

    return view;
  },

  //
  // ## Get Or Create View For Model
  //
  // Tries to find an instantiated view. If we don't have it create a new one.
  //
  // * **model**, the model to find or create a view for.
  //
  // **Returns** a view.
  //
  getOrCreateViewForModel: function (model) {
    return this.viewForModel(model) || this.createViewForModel(model);
  },

});

GridView.extend = AmpersandExtend;
module.exports = GridView;
