// vim:set et sw=4 ts=4 tw=72:
// Evan Wilde (c) 2017

/////////////////
//  Utilities  //
/////////////////

var apply = function(list, callback) {
    for (var i = 0, len = list.length; i < len; i++) { callback(list[i], i); }
}

var filter = function(list, cond) {
    if (cond === undefined) { return list; }
	let result = [];
    for (const el of list) {if (cond(el)) {result.push(el);}}
    return result;
}

var apply_if = function(list, cond, callback) {
    apply(filter(list, cond), callback);
}

var map = function(list, func) {
    if (func === undefined) { return list; }
    let result = [];
    for (item of list) { result.push(func(item)); }
    return result;
}

///////////////////////
//  Gallery Actions  //
///////////////////////

// gallery is a current image and a list of images
function Gallery() {
    this._index = 0;
    this._images = [];
}

// Add a new image to the gallery
Gallery.prototype.add = function(imageNode) { this._images.push(imageNode); }

// Go to the next or previous image
Gallery.prototype.next = function() { this._index = (this._index + 1) % this._images.length;}
Gallery.prototype.previous = function() { this._index -= 1; if (this._index < 0) { this._index = this._images.length - 1;} }

// Get the total number of images
Gallery.prototype.total = function() { return this._images.length; }

// Get the current image node
Gallery.prototype.get = function() { return this._images[this._index]; }

////////////////////
//  Actual Stuff  //
////////////////////

var galleryMap = new Map();

var extractImages = function(gallery, callback) {
    callback(map(gallery.getElementsByTagName("li"), function(item) { return item.getElementsByTagName('img')[0]; }));
}

var presentGallery = function(Gallery, callback) {
    var galleryNode = document.createElement("div");
    galleryNode.className = "gallery";

    if (Gallery.get() != undefined && Gallery.get().alt !== undefined && Gallery.get().alt !== "") {
        var titleNode = document.createElement('div');
        var titleText = document.createTextNode(Gallery.get().alt);
        titleNode.className = "gallery-title";
        titleNode.appendChild(titleText);
        galleryNode.appendChild(titleNode);
    }

    if (Gallery._images.length > 1) {
        var nextButtonNode = document.createElement("div");
        var prevButtonNode = document.createElement("div");
        nextButtonNode.appendChild(document.createTextNode(">"));
        prevButtonNode.appendChild(document.createTextNode("<"));

        nextButtonNode.className = "gallery-button gallery-next";
        prevButtonNode.className = "gallery-button gallery-previous";
        nextButtonNode.onclick = function() { Gallery.next(); presentGallery(Gallery, callback);};
        prevButtonNode.onclick = function() { Gallery.previous(); presentGallery(Gallery, callback);};

        galleryNode.appendChild(nextButtonNode);
        galleryNode.appendChild(prevButtonNode);
    }

    let imageDivNode = document.createElement("div");
    imageDivNode.appendChild(Gallery.get());
    galleryNode.appendChild(imageDivNode);

    callback(galleryNode);
}

let elements = Array.prototype.slice.call(document.getElementsByClassName('gallery'));
apply(elements, function(gallery, i){
    galleryMap.set(gallery, new Gallery());
    extractImages(gallery, function(images) { apply(images, function(image) { galleryMap.get(gallery).add(image);})});
    presentGallery(galleryMap.get(gallery), function(present) {
        gallery.innerHTML = '';
        gallery.appendChild(present);
    });
});
