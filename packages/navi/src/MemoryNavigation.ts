import { createMemoryHistory, History } from 'history';
import { Switch } from './Switch'
import { Navigation, NavigationSnapshot } from './Navigation'
import { Resolver } from './Resolver'
import { Router, RouterOptions } from './Router'
import { Route } from './Route'
import { Observer, SimpleSubscription, createOrPassthroughObserver } from './Observable'
import { CurrentRouteObservable, createCurrentRouteObservable } from './CurrentRouteObservable';
import { URLDescriptor, createURLDescriptor } from './URLTools';


export interface MemoryNavigationOptions<Context extends object> extends RouterOptions<Context> {
    url: string | Partial<URLDescriptor>

    initialContext?: Context,

    pages: Switch,
    rootPath?: string,
}


export function createMemoryNavigation<Context extends object>(options: MemoryNavigationOptions<Context>) {
    return new MemoryNavigation(options)
}


export class MemoryNavigation<Context extends object> implements Navigation<Context> {
    router: Router<Context>

    readonly history: History

    private pages: Switch
    private rootPath?: string
    private resolver: Resolver

    private currentRouteObservable: CurrentRouteObservable<Context>

    constructor(options: MemoryNavigationOptions<Context>) {
        this.history = createMemoryHistory({
            initialEntries: [createURLDescriptor(options.url).href],
        })
        this.resolver = new Resolver
        this.pages = options.pages
        this.rootPath = options.rootPath
        this.router = new Router(this.resolver, {
            rootContext: options.initialContext,
            pages: this.pages,
            rootPath: this.rootPath,
        })
        this.currentRouteObservable = createCurrentRouteObservable({
            history: this.history,
            router: this.router,
        })
    }

    setContext(context: Context) {
        this.router = new Router(this.resolver, {
            rootContext: context,
            pages: this.pages,
            rootPath: this.rootPath,
        })
        this.currentRouteObservable.setRouter(this.router)
    }

    getCurrentValue(): NavigationSnapshot {
        let route = this.currentRouteObservable.getValue()
        return {
            route,
            url: route.url,
            history: this.history,
            router: this.router,
            onRendered: noop,
        }
    }

    async getSteadyValue(): Promise<NavigationSnapshot> {
        return this.currentRouteObservable.getSteadyRoute().then(route => ({
            route,
            url: route.url,
            history: this.history,
            router: this.router,
            onRendered: noop,
        }))
    }

    /**
     * If you're using code splitting, you'll need to subscribe to changes to
     * the snapshot, as the route may change as new code chunks are received.
     */
    subsc
    subscribe(
        onNextOrObserver: Observer<NavigationSnapshot> | ((value: NavigationSnapshot) => void),
        onError?: (error: any) => void,
        onComplete?: () => void
    ): SimpleSubscription {
        let navigationObserver = createOrPassthroughObserver(onNextOrObserver, onError, onComplete)
        let mapObserver = new MapObserver(navigationObserver, this.history, this.router)
        return this.currentRouteObservable.subscribe(mapObserver)
    }
}


const noop = () => {}


class MapObserver implements Observer<Route> {
    history: History
    router: Router<any>
    observer: Observer<NavigationSnapshot>

    constructor(observer: Observer<NavigationSnapshot>, history: History, router: Router<any>) {
        this.observer = observer
        this.history = history
        this.router = router
    }

    next(route: Route): void {
        this.observer.next({
            route,
            url: route.url,
            history: this.history,
            router: this.router,
            onRendered: noop,
        })
    }
    error(errorValue: any): void {
        if (this.observer.error) {
            this.observer.error(errorValue)
        }
    }
}