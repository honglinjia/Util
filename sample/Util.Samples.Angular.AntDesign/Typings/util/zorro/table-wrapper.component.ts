﻿//============== NgZorro表格包装器=======================
//Copyright 2019 何镇汐
//Licensed under the MIT license
//=======================================================
import { Component, Input, Output, AfterContentInit, EventEmitter } from '@angular/core';
import { SelectionModel } from '@angular/cdk/collections';
import { WebApi as webapi } from '../common/webapi';
import { Message as message } from '../common/message';
import { PagerList } from '../core/pager-list';
import { IKey, QueryParameter } from '../core/model';
import { MessageConfig as config } from '../config/message-config';
import { DicService } from '../services/dic.service';
import { Util as util } from '../util';

/**
 * NgZorro表格包装器
 */
@Component( {
    selector: 'nz-table-wrapper',
    template: `
        <ng-content></ng-content>
    `,
    styles: [`
    `]
} )
export class TableWrapperComponent<T extends IKey> implements AfterContentInit {
    /**
     * 查询延迟
     */
    timeout;
    /**
     * 查询延迟间隔，单位：毫秒，默认500
     */
    @Input() delay: number;
    /**
     * 显示进度条
     */
    loading: boolean;
    /**
     * 首次加载
     */
    firstLoad: boolean;
    /**
     * 总行数
     */
    totalCount = 0;
    /**
     * 数据源
     */
    dataSource: any[];
    /**
     * checkbox选中列表
     */
    checkedSelection: SelectionModel<T>;
    /**
     * 点击行选中列表
     */
    selectedSelection: SelectionModel<T>;
    /**
     * 键
     */
    @Input() key: string;
    /**
     * 初始化时是否自动加载数据，默认为true,设置成false则手工加载
     */
    @Input() autoLoad: boolean;
    /**
     * 最大高度
     */
    @Input() maxHeight: number;
    /**
     * 最小高度
     */
    @Input() minHeight: number;
    /**
     * 宽度
     */
    @Input() width: number;
    /**
     * 是否显示分页
     */
    @Input() showPagination: boolean;
    /**
     * 分页长度列表
     */
    @Input() pageSizeOptions: number[];
    /**
    * 基地址，基于该地址构建加载地址和删除地址，范例：传入test,则加载地址为/api/test,删除地址为/api/test/delete
    */
    @Input() baseUrl: string;
    /**
     * 数据加载地址，范例：/api/test
     */
    @Input() url: string;
    /**
     * 删除地址，注意：由于支持批量删除，所以采用Post提交，范例：/api/test/delete
     */
    @Input() deleteUrl: string;
    /**
     * 查询参数
     */
    @Input() queryParam: QueryParameter;
    /**
     * 初始排序字段
     */
    @Input() sortKey: string;
    /**
     * 查询参数变更事件
     */
    @Output() queryParamChange = new EventEmitter<QueryParameter>();

    /**
     * 初始化表格包装器
     */
    constructor( private dic: DicService<QueryParameter> ) {
        this.minHeight = 300;
        this.pageSizeOptions = [10, 20, 50, 100];
        this.showPagination = true;
        this.dataSource = new Array<any>();
        this.checkedSelection = new SelectionModel<T>( true, [] );
        this.selectedSelection = new SelectionModel<T>( false, [] );
        this.firstLoad = true;
        this.loading = true;
        this.autoLoad = true;
        this.queryParam = new QueryParameter();
        this.delay = 500;
    }

    /**
     * 内容加载完成时进行初始化
     */
    ngAfterContentInit() {
        this.initPaginator();
        this.initSort();
        this.restoreQueryParam();
        if ( this.autoLoad )
            this.query();
    }

    /**
     * 初始化分页组件
     */
    private initPaginator() {
        this.initPage();
    }

    /**
     * 初始化分页参数
     */
    private initPage() {
        this.queryParam.page = 1;
        if ( this.pageSizeOptions && this.pageSizeOptions.length > 0 )
            this.queryParam.pageSize = this.pageSizeOptions[0];
    }

    /**
     * 页索引变更事件处理
     * @param pageIndex 页索引，第一页传入的是1
     */
    pageIndexChange( pageIndex: number ) {
        this.queryParam.page = pageIndex;
        this.query();
    }

    /**
     * 分页大小变更事件处理
     * @param pageSize 分页大小
     */
    pageSizeChange( pageSize: number ) {
        this.queryParam.pageSize = pageSize;
        this.queryParam.page = 1;
        this.query();
    }

    /**
    * 初始化排序
    */
    private initSort() {
        if ( !this.sortKey )
            return;
        this.queryParam.order = this.sortKey;
    }

    /**
     * 还原查询参数
     */
    private restoreQueryParam() {
        if ( !this.key )
            return;
        let query = this.dic.get( this.key );
        if ( !query )
            return;
        this.queryParam = query;
        this.queryParamChange.emit( query );
    }

    /**
     * 排序
     * @param sortParam 排序参数，key为列名，value为升降序
     */
    sort( sortParam: { key: string; value: string } ): void {
        this.queryParam.order = this.getSortKey( sortParam.key, sortParam.value );
        this.query();
    }

    /**
     * 获取排序字段
     */
    private getSortKey( sortKey, sortValue ) {
        if ( !sortValue )
            return this.sortKey;
        if ( sortValue === 'ascend' )
            return sortKey;
        return `${sortKey} desc`;
    }

    /**
     * 发送查询请求
     * @param url 查询请求地址
     * @param param 查询参数
     * @param button 按钮
     */
    query( url: string = null, param = null, button?) {
        url = url || this.url || ( this.baseUrl && `/api/${this.baseUrl}` );
        if ( !url ) {
            console.log( "表格url未设置" );
            return;
        }
        param = param || this.queryParam;
        if ( this.key )
            this.dic.add( this.key, param );
        webapi.get<any>( url ).param( param ).button( button ).handle( {
            before: () => {
                if ( this.firstLoad ) {
                    this.firstLoad = false;
                    return true;
                }
                this.loading = true;
                return true;
            },
            ok: result => {
                this.loadData( result );
            },
            complete: () => this.loading = false
        } );
    }

    /**
     * 加载数据
     */
    private loadData( result ) {
        result = new PagerList<T>( result );
        result.initLineNumbers();
        this.dataSource = result.data || [];
        this.totalCount = result.totalCount;
        this.checkedSelection.clear();
        if ( result.totalCount ) {
            this.showPagination = true;
            return;
        }
        this.showPagination = false;
    }

    /**
     * 延迟搜索
     * @param delay 查询延迟间隔，单位：毫秒，默认500
     */
    search( delay?: number ) {
        if ( this.timeout )
            clearTimeout( this.timeout );
        this.timeout = setTimeout( () => {
            this.query();
        }, delay || this.delay );
    }

    /**
     * 刷新
     * @param queryParam 查询参数
     */
    refresh( queryParam ) {
        this.queryParam = queryParam;
        this.initPage();
        this.queryParam.order = this.sortKey;
        this.dic.remove( this.key );
        this.query();
    }

    /**
     * 清空数据
     */
    clear() {
        //this.dataSource.data = new PagerList<T>().data;
        //this.paginator.pageIndex = 1;
        this.totalCount = 0;
        this.checkedSelection.clear();
    }

    /**
     * 表头主复选框切换选中状态
     */
    masterToggle() {
        if ( this.isMasterChecked() ) {
            this.checkedSelection.clear();
            return;
        }
        this.dataSource.forEach( data => this.checkedSelection.select( data ) );
    }

    /**
     * 表头主复选框的选中状态
     */
    isMasterChecked() {
        return this.checkedSelection.hasValue() &&
            this.isAllChecked() &&
            this.checkedSelection.selected.length >= this.dataSource.length;
    }

    /**
     * 是否所有行复选框被选中
     */
    private isAllChecked() {
        return this.dataSource.every( data => this.checkedSelection.isSelected( data ) );
    }

    /**
     * 表头主复选框的确定状态
     */
    isMasterIndeterminate() {
        return this.checkedSelection.hasValue() && ( !this.isAllChecked() || !this.dataSource.length );
    }

    /**
     * 获取复选框被选中实体列表
     */
    getChecked(): T[] {
        return this.dataSource.filter( data => this.checkedSelection.isSelected( data ) );
    }

    /**
     * 获取复选框被选中实体Id列表
     */
    getCheckedIds(): string {
        return this.getChecked().map( ( value ) => value.id ).join( "," );
    }

    /**
     * 批量删除被选中实体
     * @param ids 待删除的Id列表，多个Id用逗号分隔，范例：1,2,3
     * @param handler 删除成功回调函数
     * @param url 服务端删除Api地址，如果设置了基地址baseUrl，则可以省略该参数
     * @param button 按钮
     */
    delete( ids?: string, handler?: () => void, url?: string, button?) {
        ids = ids || this.getCheckedIds();
        if ( !ids ) {
            message.warn( config.deleteNotSelected );
            return;
        }
        message.confirm( config.deleteConfirm, () => {
            this.deleteRequest( ids, handler, url, button );
        } );
    }

    /**
     * 发送删除请求
     */
    private deleteRequest( ids?: string, handler?: () => void, deleteUrl?: string, button?) {
        deleteUrl = deleteUrl || this.deleteUrl || ( this.baseUrl && `/api/${this.baseUrl}/delete` );
        if ( !deleteUrl ) {
            console.log( "表格deleteUrl未设置" );
            return;
        }
        webapi.post( deleteUrl, ids ).button( button ).handle( {
            ok: () => {
                if ( handler ) {
                    handler();
                    return;
                }
                message.success( config.deleteSuccessed );
                this.query();
            }
        } );
    }

    /**
     * 选中一行
     * @param row 行
     */
    checkRow( row ) {
        this.checkedSelection.clear();
        this.checkedSelection.select( row );
    }
}