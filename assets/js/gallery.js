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
        var nextButtonNode = document.createElement("button");
        nextButtonNode.style.border = 0;
        nextButtonNode.setAttribute("aria-label", "next")
        var prevButtonNode = document.createElement("button");
        prevButtonNode.style.border = 0;
        prevButtonNode.setAttribute("aria-label", "previous")

        var nextChevronSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        nextChevronSVG.setAttributeNS(null, "width", "16");
        nextChevronSVG.setAttributeNS(null, "height", "16");
        nextChevronSVG.setAttributeNS(null, "fill", "white");
        nextChevronSVG.setAttributeNS(null, "viewBox", "0 0 16 16");
        nextChevronSVG.setAttributeNS(null, "class", "ui ui-chevron-right");

        var nextChevronPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        nextChevronPath.setAttributeNS(null, "fill-rule", "evenodd");
        nextChevronPath.setAttributeNS(null, 'd', "M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z");
        nextChevronSVG.appendChild(nextChevronPath);

        var prevChevronSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        prevChevronSVG.setAttributeNS(null, "width", "16");
        prevChevronSVG.setAttributeNS(null, "height", "16");
        prevChevronSVG.setAttributeNS(null, "fill", "white");
        prevChevronSVG.setAttributeNS(null, "viewBox", "0 0 16 16");
        prevChevronSVG.setAttributeNS(null, "class", "ui ui-chevron-left");

        var prevChevronPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        prevChevronPath.setAttributeNS(null, "fill-rule", "evenodd");
        prevChevronPath.setAttributeNS(null, 'd', "M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z");
        prevChevronSVG.appendChild(prevChevronPath);

        nextButtonNode.appendChild(nextChevronSVG);
        prevButtonNode.appendChild(prevChevronSVG);

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

    let resetGallery = function(gallery, presentation) {
        gallery.innerHTML = '';
        gallery.appendChild(presentation);
    }

    presentGallery(galleryMap.get(gallery), function(present) {
        resetGallery(gallery, present);
    });

    window.addEventListener('keydown', function(e) {
        var selectedGallery = galleryMap.get(gallery);
        e = e || window.event;
        if (e.keyCode === 39) {
            selectedGallery.next();
        } else if (e.keyCode === 37) {
            selectedGallery.previous();
        }
        presentGallery(selectedGallery, function(present) {
            resetGallery(gallery, present);
        });
    });
});
