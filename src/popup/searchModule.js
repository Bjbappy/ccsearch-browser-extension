import { elements, appObject } from './base';
import { addLoadMoreButton, removeLoadMoreButton } from './helper';
// eslint-disable-next-line import/no-cycle
import { activatePopup } from './infoPopupModule';
import { removeSpinner } from './spinner';
// eslint-disable-next-line import/no-cycle
import toggleBookmark from './bookmarkModule';
import primaryGridMasonryObject from './searchModule.utils';
import { showNotification, removeChildNodes, activeBookmarkIdContainers, checkInternetConnection } from '../utils';

export function checkInputError(inputText) {
  if (inputText === '') {
    showNotification('No search query provided', 'negative', 'notification--extension-popup');
    // to stop further js execution
    throw new Error('No search query provided');
  }
}

export function removeOldSearchResults() {
  // remove old images for a new search
  const div = document.createElement('div');
  div.classList.add('gutter-sizer');
  removeChildNodes(elements.gridPrimary);
  elements.gridPrimary.appendChild(div);
}

export function getRequestUrl(
  searchQuery,
  useCaseFilters,
  licenseFilters,
  sourceFilters,
  fileTypeFilters,
  imageTypeFilters,
  imageSizeFilters,
  aspectRatioFilters,
  pageNo,
  enableMatureContent,
) {
  if (useCaseFilters.length > 0) {
    return `https://api.creativecommons.engineering/v1/images?q=${searchQuery}&page=${pageNo}&page_size=20&license_type=${useCaseFilters}&source=${sourceFilters}&extension=${fileTypeFilters}&categories=${imageTypeFilters}&size=${imageSizeFilters}&aspect_ratio=${aspectRatioFilters}&mature=${enableMatureContent}`;
  }
  return `https://api.creativecommons.engineering/v1/images?q=${searchQuery}&page=${pageNo}&page_size=20&license=${licenseFilters}&source=${sourceFilters}&extension=${fileTypeFilters}&categories=${imageTypeFilters}&size=${imageSizeFilters}&aspect_ratio=${aspectRatioFilters}&mature=${enableMatureContent}`;
}

export function getCollectionsUrl(collectionName, pageNo) {
  return `https://api.creativecommons.engineering/v1/images?source=${collectionName}&page=${pageNo}&page_size=20`;
}

export function getTagsUrl(tagName, pageNo) {
  return `https://api.creativecommons.engineering/v1/images?tags=${tagName}&page=${pageNo}&page_size=20`;
}

export function checkResultLength(resultArray) {
  if (resultArray.length === 0) {
    showNotification(
      'No Images Found. Please enter a different query.',
      'negative',
      'notification--extension-popup',
      4000,
    );
    removeSpinner(elements.spinnerPlaceholderPrimary);
    removeLoadMoreButton(elements.loadMoreSearchButtonWrapper);
    primaryGridMasonryObject.layout();
    throw new Error('No image found');
  } else {
    // render the "Load More" button if non empty result
    addLoadMoreButton(elements.loadMoreSearchButtonWrapper);
  }
}

function appendToGrid(msnryObject, fragment, divs, grid) {
  grid.appendChild(fragment);
  msnryObject.appended(divs);
  // eslint-disable-next-line no-undef
  imagesLoaded(grid).on('progress', () => {
    // layout Masonry after each image loads
    msnryObject.layout();
  });
  removeSpinner(elements.spinnerPlaceholderPrimary);
  // Don't show "load more results" button for empty searches
  if (msnryObject.cols) {
    addLoadMoreButton(elements.loadMoreSearchButtonWrapper);
  }
}

export function checkValidationError(apiResponse) {
  if (Object.prototype.hasOwnProperty.call(apiResponse, 'error_type')) {
    removeLoadMoreButton(elements.loadMoreSearchButtonWrapper);
    removeSpinner(elements.spinnerPlaceholderPrimary);

    if (apiResponse.error_type === 'InputError') {
      showNotification('Not a valid search query.', 'negative', 'notification--extension-popup');
    } else {
      showNotification(
        'Some error occured. Please try again after some time.',
        'negative',
        'notification--extension-popup',
      );
    }

    throw new Error('400 Bad Request');
  }
}

export function addSearchThumbnailsToDOM(masonryObject, resultArray, gridDiv) {
  const divs = [];
  const fragment = document.createDocumentFragment();

  chrome.storage.sync.get(activeBookmarkIdContainers, items => {
    let allBookmarksImageIdsObject = {};
    activeBookmarkIdContainers.forEach(bookmarkIdContainerName => {
      allBookmarksImageIdsObject = { ...allBookmarksImageIdsObject, ...items[bookmarkIdContainerName] };
    });
    const allBookmarksImageIds = Object.keys(allBookmarksImageIdsObject);

    resultArray.forEach(element => {
      const thumbnail = element.thumbnail ? element.thumbnail : element.url;
      const { license, id } = element;
      const licenseArray = license.split('-'); // split license in individual characteristics

      // make an image element
      const imgElement = document.createElement('img');
      imgElement.setAttribute('src', thumbnail);
      imgElement.setAttribute('class', 'image-thumbnail');
      imgElement.setAttribute('id', id);

      const bookmarkIconDiv = document.createElement('div');
      bookmarkIconDiv.classList.add('bookmark-icon');

      const licenseDiv = document.createElement('div');
      licenseDiv.classList.add('image-icons');

      // Array to hold license image elements
      const licenseIconElementsArray = [];

      // Add the default cc icon
      let licenseIconElement = document.createElement('i');
      licenseIconElement.classList.add('icon', 'has-background-white', 'cc-logo');
      licenseIconElementsArray.push(licenseIconElement);

      // make and push license image elements
      licenseArray.forEach(name => {
        licenseIconElement = document.createElement('i');
        // for pdm, the logo name is cc-pd and for cc0, the logo name is cc-zero
        if (name === 'pdm') licenseIconElement.classList.add('icon', 'has-background-white', 'cc-pd');
        else if (name === 'cc0') licenseIconElement.classList.add('icon', 'has-background-white', 'cc-zero');
        else licenseIconElement.classList.add('icon', 'has-background-white', `cc-${name}`);
        licenseIconElementsArray.push(licenseIconElement);
      });

      licenseIconElementsArray.forEach(licenseIcon => {
        licenseDiv.appendChild(licenseIcon);
      });

      const bookmarkIcon = document.createElement('i');
      bookmarkIcon.classList.add('icon');
      bookmarkIcon.id = 'bookmark-icon';
      bookmarkIcon.setAttribute('data-image-id', id);
      bookmarkIcon.setAttribute('data-image-thumbnail', thumbnail);
      bookmarkIcon.setAttribute('data-image-license', license);
      bookmarkIcon.addEventListener('click', toggleBookmark);

      bookmarkIconDiv.appendChild(bookmarkIcon);

      if (allBookmarksImageIds.indexOf(id) === -1) {
        bookmarkIcon.classList.add('bookmark-regular');
        bookmarkIcon.title = 'Bookmark image';
      } else {
        bookmarkIcon.classList.add('bookmark-solid');
        bookmarkIcon.title = 'Remove Bookmark';
      }

      // make a div element to encapsulate image element
      const divElement = document.createElement('div');
      divElement.classList.add('image', 'is-compact');

      // adding event listener to open popup.
      divElement.addEventListener('click', e => {
        if (e.target.classList.contains('image-thumbnail')) {
          checkInternetConnection();
          activatePopup(e.target);
        }
      });

      divElement.appendChild(imgElement);
      divElement.appendChild(bookmarkIconDiv);
      divElement.appendChild(licenseDiv);

      // div to act as grid itemj
      const gridItemDiv = document.createElement('div');
      gridItemDiv.setAttribute('class', 'grid-item');

      gridItemDiv.appendChild(divElement);

      fragment.appendChild(gridItemDiv);
      divs.push(gridItemDiv);
    });

    appendToGrid(masonryObject, fragment, divs, gridDiv);
  });
}

export function search(url) {
  fetch(url)
    .then(data => data.json())
    .then(res => {
      checkValidationError(res);
      const resultArray = res.results;

      checkResultLength(resultArray);
      addSearchThumbnailsToDOM(primaryGridMasonryObject, resultArray, elements.gridPrimary);

      appObject.pageNo += 1;
    });
}
