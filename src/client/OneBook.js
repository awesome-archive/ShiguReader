import React, { Component } from 'react';
import _ from 'underscore';
const nameParser = require('../name-parser');
const classNames = require('classnames');
const dateFormat = require('dateformat');
import ReactDOM from 'react-dom';

import { Link } from 'react-router-dom';
import Sender from './Sender';
import './style/OneBook.scss';
import ErrorPage from './ErrorPage';
import CenterSpinner from './subcomponent/CenterSpinner';
import ClickAndCopyText from './subcomponent/ClickAndCopyText';
const spop  = require("./subcomponent/spop");
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
import LoadingImage from './LoadingImage';
import MusicPlayer from './MusicPlayer';
import $ from 'jquery'
import "./style/BigColumnButton.scss";

const util = require("../util");
const queryString = require('query-string');
const stringHash = util.stringHash;
const filesizeUitl = require('filesize');
import screenfull from 'screenfull';
const getUrl = util.getUrl;
const Constant = require("../constant");

const MIN_HEIGHT = 400;
const userConfig = require('../user-config');

export default class OneBook extends Component {
  constructor(props) {
    super(props);
    this.state = {
      files: [],
      musicFiles: [],
      index: this.getInitIndex()
    };
    this.failTimes = 0;
  }

  getInitIndex(){
    const parsed = queryString.parse(location.hash);
    return parseInt(parsed.index) || 0;
  }

  setIndex(index){
    location.hash = queryString.stringify({index});
  }

  getHash(){
    return this.props.match.params.number;
  }
  
  componentDidMount() {
    const file = this.getHash();
    if(file && this.loadedHash !== file && this.failTimes < 3){
      this.displayFile(file);
    }

    if(!_.isPad ()){
      screenfull.onchange(()=> {
        this.forceUpdate();
      });
     }

    window.addEventListener("resize", this.adjustImageSizeAfterResize.bind(this));
  }
  
  componentDidUpdate() {
    this.componentDidMount();
  }

  updateScrollPos(e) {
    // $('html').css('cursor', 'row-resize');
    // console.log(this.clickY, e.pageY, this.clickY - e.pageY );
    const ADJUSTER = 1.05;
    let change = $(window).scrollTop() + (this.clickY - e.pageY) * ADJUSTER;
    $(window).scrollTop(change);
    // console.log(change)
  }

  adjustImageSizeAfterResize(){
    this.applyHeightToImage(this.getMaxHeight());
  }

  getMaxHeight(){
    if(_.isPad()){
      return window.screen.height - 10;
     }

    let maxHeight = 952;
    if (this.hasMusic()){
      maxHeight = 450;
    } else {
      maxHeight = isNaN(window.innerHeight) ? window.clientHeight : window.innerHeight;
    }
    return maxHeight - 10;
  }

  getMaxWidth(){
    if(_.isPad()){
     return window.screen.width;
    }
    const result = isNaN(window.innerWidth) ? window.clientWidth : window.innerWidth;
    return result - 10;
  }

  adjustImageSize(){
    if(_.isPad()){
      return;
    }

    this.loadedImage = this.state.index;
    const imageDom = ReactDOM.findDOMNode(this.imgRef);
    this.imgHeight = imageDom.clientHeight;
    this.imgWidth = imageDom.clientWidth

    //display img's real px number
    const dimDom = document.getElementsByClassName("dimension-tag")[0];
    dimDom.textContent = `${imageDom.naturalWidth}×${imageDom.naturalHeight}`;

    this.clicked = false;
    this.clickY = 0;

    //set max height
    const maxHeight = this.getMaxHeight();
    const maxWidth = this.getMaxWidth();

    const widthRatio = this.imgWidth / maxWidth;
    const heighthRatio = this.imgHeight / maxHeight;

    //only need to adjust one dimension
    if(widthRatio > 1 && widthRatio > heighthRatio){
      this.applyWidthToImage(maxWidth);
    }else if(heighthRatio > 1) {
      this.applyHeightToImage(maxHeight);
    }

    // if(this.imgHeight < MIN_HEIGHT){
    //   this.applyHeightToImage(MIN_HEIGHT);
    // }
  }


  applyWidthToImage(width){
    this.imgWidth = width;
    const MIN_WIDTH = 400;
    width = Math.max(width, MIN_WIDTH);

    let imageDom = ReactDOM.findDOMNode(this.imgRef);
    imageDom && imageDom.setAttribute("width", width);
  }

  applyHeightToImage(height){
    this.imgHeight = height;
    height = Math.max(height, MIN_HEIGHT);

    let imageDom = ReactDOM.findDOMNode(this.imgRef);
    imageDom && imageDom.setAttribute("height", height);

    this.makeTwoImageSameHeight();
  }

  onwheel(e){
    const CHANGE_RATE = 1.05;
    this.applyHeightToImage(e.wheelDelta > 0?  this.imgHeight * CHANGE_RATE : this.imgHeight / CHANGE_RATE);
    e.preventDefault && e.preventDefault();
  }

  makeTwoImageSameHeight(){
    if(this.state.clipWithPrev){
      let imageDom = ReactDOM.findDOMNode(this.prevImgRef);
      imageDom && imageDom.setAttribute("height", this.imgHeight);
    }
  }

  rotateImg(newAngle){
    let imageDom = ReactDOM.findDOMNode(this.imgRef);
    if(imageDom){
      if(typeof newAngle === "number"){ 
        this.rotateAngle = newAngle;
      }else{
        this.rotateAngle = (this.rotateAngle||0) + 90;
      }
      imageDom.setAttribute("style", "transform: rotate(" + this.rotateAngle + "deg)");
    }
  }

  bindUserInteraction(){
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    if(this.hasMusic() || _.isPad()){
      return;
    }

    const imageDom = ReactDOM.findDOMNode(this.wrapperRef);
    this.imgHeight = imageDom.clientHeight;
    imageDom.addEventListener("wheel", this.onwheel.bind(this), {passive: false} );

    const that = this;
    $(imageDom).on({
      'mousemove': function(e) {
          that.clicked && that.updateScrollPos(e);
          e.preventDefault();
      },
      'mousedown': function(e) {
          that.clicked = true;
          that.clickY = e.pageY;
          e.preventDefault();
      },
      'mouseup': function(e) {
          that.clicked = false;
          // $('html').css('cursor', 'auto');
          e.preventDefault();
      }
    });
  }
  
  displayFile(file){
    Sender.post("/api/extract", {fileName: this.getPathFromLocalStorage(),   hash: this.getHash() }, res => {
      this.res = res;
      if (!res.failed) {
        this.loadedHash = this.getHash();
        let files = res.files || [];
        files = files.filter(e => {
          return !util.isCompressedThumbnail(e);
        })

        //files name can be 001.jpg, 002.jpg, 011.jpg, 012.jpg
        //or 1.jpg, 2.jpg 3.jpg 1.jpg
        //the sort is trigger

        util.sortFileNames(files);
        let musicFiles = res.musicFiles || [];
        util.sortFileNames(musicFiles);
        this.setState({ files, musicFiles, path:res.path, fileStat: res.stat });

        this.bindUserInteraction();
      }else{
        this.failTimes++;
        this.forceUpdate();
      }
    });
  }
  
  componentWillUnmount() {
    document && document.removeEventListener("keydown", this.handleKeyDown.bind(this));
    window && window.removeEventListener("resize", this.adjustImageSizeAfterResize.bind(this));
  }
  
  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key === "arrowright" || key === "d" || key === "l") {
      this.changePage(this.state.index + 1);
      event.preventDefault();
    } else if (key === "arrowleft" || key === "a" || key === "j") {
      this.changePage(this.state.index - 1);
      event.preventDefault();
    } else if (key === "+" || key === "=" ) {
      this.onwheel({wheelDelta: 1})
    } else if (key === "-" ) {
      this.onwheel({wheelDelta: -1})
    }
  }

  doClipWithPrev(){
    let next;

    if(!this.state.clipWithPrev){
      next = "right";
    }else{
      next = this.state.clipWithPrev === "right"? "left" : "right";
    }

    this.setState({
      clipWithPrev: next
    })
  }
  
  getLastIndex(){
    return (this.state.files || []).length - 1;
  }

  changePage(index, event) {
    event && event.preventDefault();
    event && event.stopPropagation();

    const lastIndex = this.getLastIndex();
    if (index < 0) {
      //do nothing
    } else if (index > lastIndex) {
      spop({
        template: 'Last Page',
        position: 'top-right',
        autoclose: 3000
      });
    }else{
      this.setState({ index: index, clipWithPrev: undefined });
      this.setIndex(index);
      this.rotateImg(0);

      // //https://stackoverflow.com/questions/4210798/how-to-scroll-to-top-of-page-with-javascript-jquery
      // document.body.scrollTop = document.documentElement.scrollTop = 0;

      $(window).scrollTop(0);
    }
  }
  
  next(event) {
    if(this.state.files.length <= 1){
      return;
    }
    let index = this.state.index + 1;
    this.changePage(index, event);
  }
  
  prev(event) {
    if(this.state.files.length <= 1){
      return;
    }
    let index = this.state.index - 1;
    this.changePage(index, event);
  }
  
  isFailedLoading(){
    return this.res && this.res.failed;
  }

  renderPagination() {
    if(_.isPad()){ return; }
    const { files, index } = this.state;
    const isLast = index+1 === files.length;
    const text = (index+1) + "/" + files.length;
    const cn = classNames("one-book-foot-index-number", {
      "is-last": isLast
    })
    return <div className={cn}>{text}</div>;
  }

  renderFileSizeAndTime(){
    const {fileStat,  files, index } = this.state;
    if (fileStat) {
      const size = filesizeUitl(fileStat.size, {base: 2});
      const avg = filesizeUitl(fileStat.size/files.length, {base: 2});
      const mTime = dateFormat(fileStat.mtime, "isoDate");
      const title = util.getFn(files[index], "/" );
      const dim = "";  //change by dom operation
      const titles = [
        "Modify Time",
        "Total Size",
        "Image Name",
        "Average Image Size",
        "Dimensions"
      ];

      const texts = [mTime, size, title, avg, dim].map((e, ii) => 
                    <div className={titles[ii] ==="Dimensions"? "dimension-tag": ""} 
                      key={e+ii} style={{marginLeft:"15px"}} title={titles[ii]}> {e} 
                    </div>);
      const mobilePageNum = _.isPad() && (
        <div  style={{marginLeft:"15px"}} > {`${index+1}/${files.length}`}  </div>
      )
      return <div className={"one-book-file-stat"}>{texts} {mobilePageNum} </div>
    }
  }

  renderImage(){
    const { files, index, clipWithPrev } = this.state;
    if(!_.isPad()){
      const cn = classNames("one-book-image", {
        "has-music": this.hasMusic()
      });

      const prevImg =  clipWithPrev &&  <img  className={cn} src={getUrl(files[index-1])} alt="book-image"
                                          ref={img => this.prevImgRef = img}
                                          onLoad={this.makeTwoImageSameHeight.bind(this)}
                                          index={index-1}
                                        />;
      return (<React.Fragment>
              { clipWithPrev === "right" &&  prevImg }
              <img  className={cn} src={getUrl(files[index])} alt="book-image"
                           ref={img => this.imgRef = img}
                           onLoad={this.adjustImageSize.bind(this)}
                           index={index}
                           />
              { clipWithPrev === "left" &&  prevImg }
              {index < files.length-1 &&  <link rel="preload" href={getUrl(files[index+1])} as="image" /> }
              {index > 0 && <link rel="preload" href={getUrl(files[index-1])} as="image" />}
              </React.Fragment>);    
    } else {
      let images;
      if(userConfig.onebook_only_image_per_page){
        const cn = classNames("mobile-single-image", {
          "has-music": this.hasMusic()
        });
        images = (<div className="mobile-single-image-container" 
                        ref={(e) =>  this.imgContainerRef = e}
                        onClick={this.onClickMobileOneImageContainer.bind(this)}> 
                <img className={cn} 
                  ref={(img) =>  this.imgRef = img}
                  src={getUrl(files[index])}  />
               </div>);
      }else{
        images =files.map(file => {
          return (<div key={file} className="mobile-one-book-image_array-container"> 
                      <LoadingImage className={"mobile-one-book-image"} 
                               bottomOffet={-4000}
                               topOffet={-3000}
                               url={getUrl(file)} 
                               key={file}/> 
                  </div>);
        });
      }

      return (<div className="mobile-one-book-container">
                {images}
            </div>);
    }
  }

  onClickMobileOneImageContainer(event){
    var x = event.pageX;
    var y = event.pageY;

    const dom = ReactDOM.findDOMNode(this.imgContainerRef);
    const width = dom.clientWidth;

    if(x > width/2){
      if(userConfig.mobile_click_right_side_to_go_next){
        this.next();
      }else{
        this.prev();
      }
    }else{
      if(userConfig.mobile_click_right_side_to_go_next){
        this.prev();
      }else{
        this.next();
      }
    }

    event.preventDefault();
  }

  renderPath() {
    if (!this.state.path) {
      return;
    }

    const parentPath = _.getDir(this.state.path);
    const parentHash = stringHash(parentPath);
    const toUrl = ('/explorer/'+ parentHash);
    
    return (
      <div className="one-book-path">
        <Link to={toUrl}>{parentPath} </Link>
      </div>);
  }

  renderToolbar(){
    if (!this.state.path) {
      return;
    }
    const toolbar = !_.isPad() &&
  (<FileChangeToolbar showAllButtons className="one-book-toolbar" file={this.state.path} popPosition={"top-center"}/>);
    return toolbar;
  }

  hasMusic(){
    const {musicFiles} = this.state;
    return musicFiles.length > 0;
  }

  renderMusicPlayer(){
    if(this.hasMusic()){
      const {musicFiles} = this.state;

      return <MusicPlayer  audioFiles={musicFiles} />;
    }
  }

  renderTags(){
    const result = nameParser.parse(_.getFn(this.state.path));
    const author = result && result.author;
    let tags = (result && result.tags)||[];
    //temp
    tags = author? tags.concat(author): tags;
    
    const tagDivs = tags.length > 0 && tags.map((tag)=>{
      const tagHash = stringHash(tag);
      let url = tag === author? ("/author/" + tagHash) : ("/tag/" + tagHash);
      url += "#sortOrder=" + Constant.SORT_BY_FOLDER;
      return (<div key={tag} className="one-book-foot-author" >
                <Link  target="_blank" to={url}  key={tag}>{tag}</Link>
              </div>);
    })

    return (<div className="one-book-tags">
            {tagDivs}
          </div>);
  }

  getPathFromLocalStorage(){
    const hash = this.getHash();
    return window.localStorage && window.localStorage.getItem(hash);
  }

  renderNextPrevButton(){
    if(_.isPad()){
      return;
    }

    return (
      <React.Fragment>
        <div className="big-column-button next"> <i className="fas fa-arrow-circle-right" onClick={this.next.bind(this)}></i> </div>
        <div className="big-column-button prev"> <i className="fas fa-arrow-circle-left" onClick={this.prev.bind(this)}></i>  </div>
      </React.Fragment>
    );
  }

  renderSecondBar(){
    if(_.isPad()){
      return;
    }
    return (<div className="one-book-second-toolbar">
              {this.state.index > 0 && <div className="clip-with-prev-button fas fa-arrows-alt-h" onClick={this.doClipWithPrev.bind(this)} title="clip with prev image"></div>}
              <div className="fas fa-sync-alt rotate-button" title="rotate image" onClick={this.rotateImg.bind(this)}></div>
            </div>);
  }

  render() {
    if (this.isFailedLoading()) { 
      let userText;
      if(this.res.res.status === 404){
        userText = `Does not find ${this.getPathFromLocalStorage()}.`;
      } else if (this.res.res.status === 500){
        userText = `${this.getPathFromLocalStorage()} is a broken file`;
      }

      return <ErrorPage res={this.res.res} userText={userText}/>;
    }
    
    const { files, index } = this.state;
    if (_.isEmpty(files)) {
      if(this.res && !this.refs.failed){
        return <h3><center>no content files</center></h3>;
      } else {
        return (<CenterSpinner text={this.getPathFromLocalStorage()} splitFilePath/>);
      } 
    }
    
    if(this.state.path){
      document.title = _.getFn(this.state.path);

      if(_.isPad() && index > 0){
        document.title = index.toString() + " " +  document.title;
      }
    }

    const wraperCn = classNames("one-book-wrapper", {
      "full-screen": screenfull.isFullscreen,
      "has-music": this.hasMusic(),
      "clip-with-prev": this.state.clipWithPrev
    });

    const content = (<div className={wraperCn} ref={wrapper => this.wrapperRef = wrapper}>
                      {this.renderImage()}
                      {this.renderMusicPlayer()}
    </div>);

    const isContentBelow = _.isPad() && !userConfig.onebook_only_image_per_page;

    return (  
      <div className="one-book-container">
        {!isContentBelow && content}
        <div className="one-book-title" >
            {this.renderPath()} 
            <ClickAndCopyText text={_.getFn(this.state.path)} />
        </div>
        {this.renderPagination()}
        {this.renderFileSizeAndTime()}
        {this.renderTags()}
        {this.renderToolbar()}
        {this.renderNextPrevButton()}

        {isContentBelow && content}
      </div>
    );
  }
}

OneBook.propTypes = {
};
